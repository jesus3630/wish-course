require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
// express-rate-limit removed — was crashing Railway due to X-Forwarded-For validation
const rateLimit = (opts) => (req, res, next) => next(); // passthrough stub
const multer = require('multer');
const crypto = require('crypto');
const { sendInviteEmail, sendCompletionEmail, sendManagerCompletionEmail } = require('./email');
const agent = require('./agent');

const app = express();
app.set('trust proxy', 1); // Required for express-rate-limit behind Railway's proxy
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'wish-admin';
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || path.join(__dirname, '../video_processing/screenshots');
const VIDEOS_DIR = process.env.VIDEOS_DIR || path.join('/data', 'videos');
const SITE_URL = process.env.SITE_URL || 'https://wish-training.up.railway.app';

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,  // fail fast if DB unreachable
});

// Seed files (committed to git)
const COURSE_SEED_PATH = path.join(__dirname, '../course_data.json');
const QUIZ_SEED_PATH = path.join(__dirname, '../quiz_data.json');

// ─── Encoding fix (UTF-8 mojibake from Windows-1252 misread) ─────────────────
const WIN1252_TO_BYTE = {
  0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,
  0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,
  0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,
  0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,
  0x0153:0x9C,0x017E:0x9E,0x0178:0x9F,
};
function _tryFixOnce(str) {
  try {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c in WIN1252_TO_BYTE) bytes.push(WIN1252_TO_BYTE[c]);
      else if (c < 256) bytes.push(c);
      else return null;
    }
    const r = Buffer.from(bytes).toString('utf8');
    return r.includes('�') ? null : r;
  } catch { return null; }
}
function _fixStr(s) {
  if (typeof s !== 'string') return s;
  let cur = s;
  for (let i = 0; i < 3; i++) { const f = _tryFixOnce(cur); if (!f || f === cur) break; cur = f; }
  return cur;
}
function _fixDeep(v) {
  if (typeof v === 'string') return _fixStr(v);
  if (Array.isArray(v)) return v.map(_fixDeep);
  if (v && typeof v === 'object') { const r = {}; for (const k of Object.keys(v)) r[k] = _fixDeep(v[k]); return r; }
  return v;
}
async function fixEncodingOnce() {
  for (const tbl of ['course_data', 'quiz_data']) {
    const { rows } = await pool.query(`SELECT id, data FROM ${tbl}`);
    for (const row of rows) {
      const before = JSON.stringify(row.data);
      const after = _fixDeep(row.data);
      const afterStr = JSON.stringify(after);
      if (before !== afterStr) {
        await pool.query(`UPDATE ${tbl} SET data = $1 WHERE id = $2`, [afterStr, row.id]);
        console.log(`[boot] Fixed encoding in ${tbl} row ${row.id}`);
      }
    }
  }
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_data (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS quiz_data (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL,
      type TEXT NOT NULL,
      changes JSONB NOT NULL,
      snapshot JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_progress (
      email TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      last_synced TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS narration_cache (
      text_hash TEXT PRIMARY KEY,
      audio TEXT NOT NULL,
      timings JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS client_timings (
      client_hash TEXT PRIMARY KEY,
      timings JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS roster (
      email TEXT PRIMARY KEY,
      name TEXT,
      assigned_modules JSONB DEFAULT '[]'::jsonb,
      added_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE roster ADD COLUMN IF NOT EXISTS assigned_modules JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE roster ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE roster ADD COLUMN IF NOT EXISTS password TEXT;
    ALTER TABLE roster ADD COLUMN IF NOT EXISTS requester_email TEXT;
    CREATE TABLE IF NOT EXISTS analytics_counts (
      key TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      module_id TEXT,
      label TEXT,
      hits INTEGER NOT NULL DEFAULT 0,
      misses INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const courseCheck = await pool.query('SELECT id FROM course_data WHERE id = 1');
  const jsonCourseData = JSON.parse(fs.readFileSync(COURSE_SEED_PATH, 'utf8'));
  if (courseCheck.rowCount === 0) {
    console.log('[boot] Seeding course_data from committed file');
    await pool.query('INSERT INTO course_data (id, data) VALUES (1, $1)', [JSON.stringify(jsonCourseData)]);
  } else {
    // Merge strategy:
    // 1. Add new modules from JSON (preserves DB for existing ones)
    // 2. For existing modules, apply new slide-level fields from JSON (e.g. simulation_url)
    //    without overwriting admin-edited text/slide_name/instructions fields
    const dbResult = await pool.query('SELECT data FROM course_data WHERE id = 1');
    const dbModules = dbResult.rows[0].data;
    const dbMap = new Map(dbModules.map(m => [m.id, m]));
    const newIds = jsonCourseData.filter(m => !dbMap.has(m.id)).map(m => m.id);

    // Merge each module: DB base + apply simulation_url / screenshot from JSON slides
    const SLIDE_FIELDS_FROM_JSON = ['simulation_url', 'screenshot', 'screenshot_below', 'image_below', 'image_below_2', 'image_below_caption', 'image_below_2_caption', 'image_below_highlight', 'image_below_2_highlight', 'video_start', 'video_end'];
    const merged = jsonCourseData.map(jsonMod => {
      const dbMod = dbMap.get(jsonMod.id);
      if (!dbMod) return jsonMod; // new module — use JSON fully

      // Existing module: keep DB slide content but apply structural fields from JSON
      const mergedSlides = (dbMod.slides || []).map((dbSlide, idx) => {
        const jsonSlide = (jsonMod.slides || [])[idx];
        if (!jsonSlide) return dbSlide;
        const merged = { ...dbSlide };
        for (const field of SLIDE_FIELDS_FROM_JSON) {
          if (field in jsonSlide) {
            if (jsonSlide[field] === null || jsonSlide[field] === undefined) {
              delete merged[field]; // JSON explicitly removed — remove from DB
            } else {
              merged[field] = jsonSlide[field]; // JSON added/changed — apply
            }
          }
        }
        return merged;
      });
      return { ...dbMod, slides: mergedSlides };
    });

    const hasChanges = newIds.length > 0 || merged.some((m, i) => {
      const db = dbMap.get(m.id);
      return db && JSON.stringify(db.slides) !== JSON.stringify(m.slides);
    });

    if (hasChanges) {
      if (newIds.length > 0) console.log(`[boot] Adding ${newIds.length} new module(s):`, newIds);
      console.log('[boot] Applying slide field updates from JSON (simulation_url, screenshot, etc.)');
      await pool.query(
        'UPDATE course_data SET data = $1, updated_at = NOW() WHERE id = 1',
        [JSON.stringify(merged)]
      );
    }
  }

  const quizCheck = await pool.query('SELECT id FROM quiz_data WHERE id = 1');
  if (quizCheck.rowCount === 0) {
    console.log('[boot] Seeding quiz_data from committed file');
    const quizData = JSON.parse(fs.readFileSync(QUIZ_SEED_PATH, 'utf8'));
    await pool.query('INSERT INTO quiz_data (id, data) VALUES (1, $1)', [JSON.stringify(quizData)]);
  }

  // Fix mojibake encoding (UTF-8 text misread as Windows-1252) — safe to run every boot, no-op if clean
  await fixEncodingOnce();

  console.log('[boot] DB ready');
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function getCourseData() {
  try {
    const r = await pool.query('SELECT data FROM course_data WHERE id = 1');
    return r.rows[0]?.data;
  } catch (e) {
    console.warn('[DB fallback] getCourseData using JSON file:', e.message);
    return JSON.parse(fs.readFileSync(COURSE_SEED_PATH, 'utf8'));
  }
}
async function setCourseData(data) {
  await pool.query(
    'INSERT INTO course_data (id, data, updated_at) VALUES (1, $1, NOW()) ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()',
    [JSON.stringify(data)]
  );
}
async function getQuizData() {
  try {
    const r = await pool.query('SELECT data FROM quiz_data WHERE id = 1');
    return r.rows[0]?.data;
  } catch (e) {
    console.warn('[DB fallback] getQuizData using JSON file:', e.message);
    return JSON.parse(fs.readFileSync(QUIZ_SEED_PATH, 'utf8'));
  }
}
async function setQuizData(data) {
  await pool.query(
    'INSERT INTO quiz_data (id, data, updated_at) VALUES (1, $1, NOW()) ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()',
    [JSON.stringify(data)]
  );
}

// ─── Narration cache helpers ──────────────────────────────────────────────────
function narrationHash(text) {
  return crypto.createHash('sha256').update(`${VOICE_ID}:${text}`).digest('hex');
}
function clientHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}
async function getCachedNarration(hash) {
  const r = await pool.query('SELECT audio, timings FROM narration_cache WHERE text_hash = $1', [hash]);
  return r.rows[0] ?? null;
}
async function setCachedNarration(hash, audio, timings) {
  await pool.query(
    'INSERT INTO narration_cache (text_hash, audio, timings) VALUES ($1, $2, $3) ON CONFLICT (text_hash) DO NOTHING',
    [hash, audio, JSON.stringify(timings)]
  );
}
async function setClientTimings(cHash, timings) {
  await pool.query(
    'INSERT INTO client_timings (client_hash, timings) VALUES ($1, $2) ON CONFLICT (client_hash) DO NOTHING',
    [cHash, JSON.stringify(timings)]
  ).catch(() => {});
}

// ─── Timing JSON fallback — serve from DB when static file not on Railway ─────
// Client requests /audio/{sha256(text)}.json — static files excluded from railway up
// This route intercepts missing files and serves timings from client_timings table.
app.get('/audio/:hash.json', async (req, res, next) => {
  const hash = req.params.hash;
  // Let static middleware handle it if file exists on disk
  const staticPath = path.join(__dirname, '../client/build/audio', hash + '.json');
  if (fs.existsSync(staticPath)) return next();
  // File not on disk — try DB
  try {
    const r = await pool.query('SELECT timings FROM client_timings WHERE client_hash = $1', [hash]);
    if (r.rows.length > 0) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.json(r.rows[0].timings);
    }
  } catch (e) {
    console.error('[timing-fallback] DB error:', e.message);
  }
  next(); // 404
});

// ─── Serve React build ────────────────────────────────────────────────────────
const BUILD_DIR = path.join(__dirname, '../client/build');
// Force browsers to re-fetch index.html every time — prevents stale bundle caching
app.get('/api/debug-env', (req, res) => {
  res.json({ VISIBLE_MODULES: process.env.VISIBLE_MODULES || null, MAX_MODULES: process.env.MAX_MODULES || null });
});

app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});
app.use(express.static(BUILD_DIR));

// ─── Serve local video clips (local-only; not committed to git) ───────────────
const CLIPS_DIR = path.join(__dirname, '../video_processing/clips');
app.use('/clips', express.static(CLIPS_DIR));

// ─── Serve uploaded module videos ────────────────────────────────────────────
app.use('/videos', express.static(VIDEOS_DIR));

// ─── Serve per-slide screenshots ─────────────────────────────────────────────
app.use('/screenshots', express.static(SCREENSHOTS_DIR));

// ─── Serve interactive mockup simulator ──────────────────────────────────────
app.use('/mockup', express.static(path.join(__dirname, '../scripts/record-slides')));

// ─── Public: course data ──────────────────────────────────────────────────────
app.get(['/api/course', '/api/course-v2'], async (req, res) => {
  try {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    res.set('CDN-Cache-Control', 'no-store');
    res.removeHeader('ETag');
    let data = await getCourseData();
    const maxModules = parseInt(process.env.MAX_MODULES);
    if (maxModules > 0 && Array.isArray(data)) data = data.slice(0, maxModules);
    const visibleModules = process.env.VISIBLE_MODULES;
    console.log('[course] VISIBLE_MODULES =', visibleModules, '| data type:', typeof data, '| isArray:', Array.isArray(data), '| length:', Array.isArray(data) ? data.length : 'n/a', '| first id:', Array.isArray(data) && data[0] ? data[0].id : 'n/a');
    if (visibleModules && Array.isArray(data)) {
      const ids = visibleModules.split(',').map(s => s.trim());
      data = data.filter(m => ids.includes(m.id));
      console.log('[course] after filter, length:', data.length);
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load course data' });
  }
});

// ─── Public: quiz data ────────────────────────────────────────────────────────
app.get('/api/quiz', async (req, res) => {
  try {
    res.json(await getQuizData());
  } catch (e) {
    res.status(500).json({ error: 'Failed to load quiz data' });
  }
});

// ─── Admin auth middleware ─────────────────────────────────────────────────────
async function adminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const r = await pool.query(
        'SELECT token FROM admin_sessions WHERE token = $1 AND expires_at > NOW()',
        [token]
      );
      if (r.rowCount > 0) return next();
    } catch {}
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

const adminLoginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Admin: login — issues session token ─────────────────────────────────────
app.post('/api/admin/login', adminLoginLimit, async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid password' });
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pool.query('INSERT INTO admin_sessions (token, expires_at) VALUES ($1, $2)', [token, expiresAt]);
  await pool.query('DELETE FROM admin_sessions WHERE expires_at < NOW()');
  res.json({ ok: true, token });
});

// ─── Admin: validate session token ───────────────────────────────────────────
app.get('/api/admin/validate', adminAuth, (req, res) => res.json({ ok: true }));

// ─── User login: username only (no password required) ────────────────────────
app.post('/api/login', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  const r = await pool.query(
    'SELECT email, name, assigned_modules FROM roster WHERE LOWER(username) = LOWER($1)',
    [username.trim()]
  );
  if (r.rowCount === 0) return res.status(403).json({ error: 'invalid_credentials' });
  const { email, name, assigned_modules: assigned } = r.rows[0];
  const assigned_modules = Array.isArray(assigned) && assigned.length > 0 ? assigned : null;
  res.json({ ok: true, email, name, assigned_modules });
});

// ─── History ──────────────────────────────────────────────────────────────────
function diffCourse(oldModules, newModules) {
  const changes = [];
  const oldMap = Object.fromEntries((oldModules || []).map(m => [m.id, m]));
  const newMap = Object.fromEntries((newModules || []).map(m => [m.id, m]));

  for (const m of newModules || []) {
    if (!oldMap[m.id]) { changes.push(`Module added: "${m.name}"`); continue; }
    const old = oldMap[m.id];
    if (old.name !== m.name) changes.push(`"${old.name}" renamed to "${m.name}"`);
    const slideDiff = m.slides.length - old.slides.length;
    if (slideDiff !== 0) changes.push(`"${m.name}": ${slideDiff > 0 ? '+' : ''}${slideDiff} slide(s)`);
    else {
      const textChanged = m.slides.filter((s, i) => old.slides[i] && s.text !== old.slides[i].text).length;
      if (textChanged) changes.push(`"${m.name}": ${textChanged} slide text(s) updated`);
    }
  }
  for (const m of oldModules || []) {
    if (!newMap[m.id]) changes.push(`Module deleted: "${m.name}"`);
  }
  return changes.length ? changes : ['No content changes detected'];
}

function diffQuiz(oldQuiz, newQuiz) {
  const changes = [];
  const allIds = new Set([...Object.keys(oldQuiz || {}), ...Object.keys(newQuiz || {})]);
  for (const id of allIds) {
    const oldQs = (oldQuiz || {})[id] || [];
    const newQs = (newQuiz || {})[id] || [];
    const diff = newQs.length - oldQs.length;
    if (diff !== 0) changes.push(`Module "${id}": ${diff > 0 ? '+' : ''}${diff} question(s)`);
    else {
      const changed = newQs.filter((q, i) => oldQs[i] && JSON.stringify(q) !== JSON.stringify(oldQs[i])).length;
      if (changed) changes.push(`Module "${id}": ${changed} question(s) updated`);
    }
  }
  return changes.length ? changes : ['No quiz changes detected'];
}

async function saveHistory(type, changes, snapshot) {
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  await pool.query(
    'INSERT INTO history (id, timestamp, type, changes, snapshot) VALUES ($1, NOW(), $2, $3, $4)',
    [id, type, JSON.stringify(changes), JSON.stringify(snapshot)]
  );
  // Keep only 50 most recent snapshots
  await pool.query(`
    DELETE FROM history WHERE id NOT IN (
      SELECT id FROM history ORDER BY timestamp DESC LIMIT 50
    )
  `);
}

// ─── Admin: history list ──────────────────────────────────────────────────────
app.get('/api/admin/history', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, timestamp, type, changes FROM history ORDER BY timestamp DESC LIMIT 50'
    );
    res.json(r.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      type: row.type,
      changes: row.changes,
    })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// ─── Admin: restore snapshot ──────────────────────────────────────────────────
app.post('/api/admin/restore/:id', adminAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT snapshot FROM history WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Snapshot not found' });
    const { course, quiz } = r.rows[0].snapshot;
    if (course) await setCourseData(course);
    if (quiz) await setQuizData(quiz);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Restore failed' });
  }
});

// ─── Admin: update course data ────────────────────────────────────────────────
app.put('/api/admin/course', adminAuth, async (req, res) => {
  try {
    const old = await getCourseData();
    const quiz = await getQuizData();
    const changes = diffCourse(old, req.body);
    await saveHistory('course', changes, { course: old, quiz });
    await setCourseData(req.body);
    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to save course data:', e);
    res.status(500).json({ error: 'Failed to save course data' });
  }
});

// ─── Admin: update quiz data ──────────────────────────────────────────────────
app.put('/api/admin/quiz', adminAuth, async (req, res) => {
  try {
    const course = await getCourseData();
    const old = await getQuizData();
    const changes = diffQuiz(old, req.body);
    await saveHistory('quiz', changes, { course, quiz: old });
    await setQuizData(req.body);
    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to save quiz data:', e);
    res.status(500).json({ error: 'Failed to save quiz data' });
  }
});

// ─── Admin: patch individual slide fields ─────────────────────────────────────
app.patch('/api/admin/slide', async (req, res) => {
  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { moduleId, slideIndex, fields } = req.body;
    if (!moduleId || slideIndex === undefined || !fields) {
      return res.status(400).json({ error: 'Missing moduleId, slideIndex, or fields' });
    }
    const data = await getCourseData();
    const mod = data.find(m => m.id === moduleId);
    if (!mod) return res.status(404).json({ error: `Module not found: ${moduleId}` });
    if (!mod.slides[slideIndex]) return res.status(404).json({ error: `Slide index ${slideIndex} not found` });
    Object.assign(mod.slides[slideIndex], fields);
    await setCourseData(data);
    res.json({ ok: true, updated: mod.slides[slideIndex] });
  } catch (e) {
    console.error('PATCH slide failed:', e);
    res.status(500).json({ error: 'Failed to patch slide' });
  }
});

// ─── Admin: user completion list ─────────────────────────────────────────────
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT email, data, last_synced FROM user_progress ORDER BY last_synced DESC');
    res.json(r.rows.map(row => ({
      email: row.email,
      name: row.data.user_name || 'Unknown',
      started_at: row.data.started_at,
      last_synced: row.last_synced,
      modules_completed: Object.values(row.data.modules || {}).filter(m => m.completed).length,
      modules_started: Object.values(row.data.modules || {}).filter(m => m.started).length,
    })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// ─── Admin: roster management ─────────────────────────────────────────────────
app.get('/api/admin/roster', adminAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT email, name, added_at FROM roster ORDER BY added_at DESC');
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load roster' });
  }
});

app.post('/api/admin/roster', adminAuth, async (req, res) => {
  const { email, name, assigned_modules, username, password, requester_email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    await pool.query(
      `INSERT INTO roster (email, name, assigned_modules, username, password, requester_email)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
         name = COALESCE($2, roster.name),
         assigned_modules = COALESCE($3, roster.assigned_modules),
         username = COALESCE($4, roster.username),
         password = COALESCE($5, roster.password),
         requester_email = COALESCE($6, roster.requester_email)`,
      [
        email.toLowerCase().trim(),
        name?.trim() || null,
        assigned_modules ? JSON.stringify(assigned_modules) : null,
        username || null,
        password || null,
        requester_email || null,
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to add to roster' });
  }
});

app.delete('/api/admin/roster/:email', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM roster WHERE email = $1', [req.params.email]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove from roster' });
  }
});

// ─── Admin: send invite email ─────────────────────────────────────────────────
app.post('/api/admin/invite', adminAuth, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const r = await pool.query('SELECT name FROM roster WHERE email = $1', [email.toLowerCase().trim()]);
    const name = r.rows[0]?.name || null;
    await sendInviteEmail(email, name);
    res.json({ ok: true });
  } catch (e) {
    console.error('[email] invite failed:', e.message);
    res.status(500).json({ error: 'Failed to send invite email' });
  }
});

// ─── Admin: video upload ──────────────────────────────────────────────────────
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    cb(null, VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${req.params.moduleId}${ext}`);
  },
});
const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Not a video file'));
  },
});

app.post('/api/admin/video/:moduleId', adminAuth, uploadVideo.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = path.extname(req.file.originalname) || '.mp4';
  const url = `/videos/${req.params.moduleId}${ext}`;
  console.log(`[video] Uploaded video for module ${req.params.moduleId}: ${req.file.size} bytes → ${url}`);
  res.json({ ok: true, url });
});

// ─── Admin: screenshot upload ─────────────────────────────────────────────────
app.post('/api/admin/screenshot', adminAuth, async (req, res) => {
  const { moduleId, slideIndex, imageData } = req.body;
  if (!moduleId || slideIndex === undefined || !imageData) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const dir = path.join(SCREENSHOTS_DIR, moduleId);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `slide_${slideIndex}.jpg`;
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(path.join(dir, filename), Buffer.from(base64Data, 'base64'));
    res.json({ ok: true, url: `/screenshots/${moduleId}/${filename}` });
  } catch (e) {
    console.error('Screenshot upload failed:', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ─── Narration endpoint ───────────────────────────────────────────────────────
const narrateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/narrate', narrateLimit, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });
  if (!ELEVENLABS_API_KEY) {
    return res.status(503).json({ error: 'ElevenLabs API key not configured' });
  }

  const trimmedText = text.substring(0, 5000);
  const hash = narrationHash(trimmedText);

  // Serve from cache if available — avoids hitting ElevenLabs for repeated requests
  const cached = await getCachedNarration(hash);
  if (cached) {
    // Also ensure client_timings is populated (for /audio/{hash}.json route)
    setClientTimings(clientHash(trimmedText), cached.timings);
    return res.json({ audio: cached.audio, timings: cached.timings });
  }

  const body = JSON.stringify({
    text: trimmedText,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
  });

  const options = {
    hostname: 'api.elevenlabs.io',
    path: `/v1/text-to-speech/${VOICE_ID}/with-timestamps`,
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const elReq = https.request(options, (elRes) => {
    if (elRes.statusCode !== 200) {
      res.status(502).json({ error: 'ElevenLabs error', status: elRes.statusCode });
      return;
    }
    let raw = '';
    elRes.on('data', chunk => raw += chunk);
    elRes.on('end', () => {
      try {
        const data = JSON.parse(raw);
        const chars = data.alignment?.characters ?? [];
        const starts = data.alignment?.character_start_times_seconds ?? [];
        const ends = data.alignment?.character_end_times_seconds ?? [];

        const timings = [];
        let word = '', wordStart = null;
        for (let i = 0; i < chars.length; i++) {
          const ch = chars[i];
          if (ch === ' ' || ch === '\n') {
            if (word.trim()) {
              timings.push({ word: word.trim(), start: wordStart, end: ends[i - 1] ?? ends[i] });
            }
            word = '';
            wordStart = null;
          } else {
            if (!word) wordStart = starts[i];
            word += ch;
          }
        }
        if (word.trim()) timings.push({ word: word.trim(), start: wordStart, end: ends[ends.length - 1] });

        setCachedNarration(hash, data.audio_base64, timings).catch(() => {});
        setClientTimings(clientHash(trimmedText), timings); // also store by client hash for /audio/{hash}.json fallback
        res.json({ audio: data.audio_base64, timings });
      } catch (e) {
        console.error('Failed to parse ElevenLabs response:', e);
        res.status(500).json({ error: 'Failed to parse narration response' });
      }
    });
  });

  elReq.on('error', (err) => {
    console.error('ElevenLabs request error:', err);
    res.status(500).json({ error: 'Narration request failed' });
  });

  elReq.write(body);
  elReq.end();
});

// ─── Progress tracking ────────────────────────────────────────────────────────
app.post('/api/progress', async (req, res) => {
  const { email, progress } = req.body;
  if (!email || !progress) return res.status(400).json({ error: 'Missing fields' });
  try {
    let progressToSave = progress;

    // Detect first-time completion and notify employee + manager
    if (!progress.completed_at) {
      const [existingRes, rosterRes] = await Promise.all([
        pool.query('SELECT data FROM user_progress WHERE email = $1', [email]),
        pool.query('SELECT assigned_modules, requester_email, name FROM roster WHERE email = $1', [email]),
      ]);
      const wasAlreadyComplete = existingRes.rows[0]?.data?.completed_at;
      if (!wasAlreadyComplete) {
        const assigned = rosterRes.rows[0]?.assigned_modules || [];
        const requesterEmail = rosterRes.rows[0]?.requester_email || null;
        const modulesToCheck = assigned.length > 0 ? assigned : (await getCourseData() || []).map(m => m.id);
        const allComplete = modulesToCheck.every(id => progress.modules?.[id]?.completed === true);
        if (allComplete) {
          progressToSave = { ...progress, completed_at: new Date().toISOString() };
          sendCompletionEmail(progress.user_name, email).catch(e => console.error('[email] completion send failed:', e.message));
          if (requesterEmail) {
            sendManagerCompletionEmail(requesterEmail, progress.user_name, email, progressToSave.completed_at)
              .catch(e => console.error('[email] manager notification failed:', e.message));
          }
        }
      }
    }

    await pool.query(
      'INSERT INTO user_progress (email, data, last_synced) VALUES ($1, $2, NOW()) ON CONFLICT (email) DO UPDATE SET data = $2, last_synced = NOW()',
      [email, JSON.stringify(progressToSave)]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

app.get('/api/progress/:email', async (req, res) => {
  try {
    const r = await pool.query('SELECT data, last_synced FROM user_progress WHERE email = $1', [req.params.email]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ...r.rows[0].data, last_synced: r.rows[0].last_synced });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load progress' });
  }
});

// ─── Analytics: record a learner event (public) ───────────────────────────────
// Body: { type, module_id, key, label, correct? }  — upserts an aggregate counter.
// type 'quiz' uses correct=true/false to split hits vs misses (a "miss" = struggle).
app.post('/api/analytics', async (req, res) => {
  try {
    const { type, module_id, key, label, correct } = req.body || {};
    if (!type || !key) return res.status(400).json({ error: 'type and key required' });
    const fullKey = `${type}:${key}`.slice(0, 300);
    const hit = correct === true ? 1 : 0;
    const miss = correct === false ? 1 : 0;
    await pool.query(
      `INSERT INTO analytics_counts (key, type, module_id, label, hits, misses, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (key) DO UPDATE SET
         hits = analytics_counts.hits + $5,
         misses = analytics_counts.misses + $6,
         label = COALESCE(EXCLUDED.label, analytics_counts.label),
         updated_at = NOW()`,
      [fullKey, type, module_id || null, label || null, hit, miss]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[analytics] error:', e.message);
    res.status(500).json({ error: 'Failed to record' });
  }
});

// ─── Analytics: trouble spots (admin) ─────────────────────────────────────────
app.get('/api/admin/analytics', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT key, type, module_id, label, hits, misses, updated_at
       FROM analytics_counts ORDER BY misses DESC, (hits + misses) DESC LIMIT 200`
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// ─── Training request (no auth — public) ──────────────────────────────────────
app.post('/api/request-training', async (req, res) => {
  const { name, email, department, message } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });
  const { sendTrainingRequestEmail } = require('./email');
  await sendTrainingRequestEmail({ name, email, department, message }).catch(e =>
    console.error('[request-training] email error:', e.message)
  );
  console.log(`[request-training] ${name} <${email}> (${department || 'no dept'})`);
  res.json({ ok: true });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── All other routes → React app ─────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
// Start HTTP server immediately — don't block on DB
app.listen(PORT, () => {
  console.log(`WISH Course running on port ${PORT}`);
  console.log(`[env] VISIBLE_MODULES="${process.env.VISIBLE_MODULES || '(not set)'}"`);
});

// Init DB with retry — keeps retrying every 10s until success, never crashes the process
async function bootWithRetry(attempt = 1) {
  try {
    await initDB();
    console.log('[boot] DB init complete');
    agent.start(pool);
  } catch (err) {
    console.error(`[boot] DB init failed (attempt ${attempt}), retrying in 10s:`, err.message);
    setTimeout(() => bootWithRetry(attempt + 1), 10000);
  }
}
bootWithRetry();
