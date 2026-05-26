require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const crypto = require('crypto');
const { sendInviteEmail, sendCompletionEmail, sendManagerCompletionEmail } = require('./email');
const agent = require('./agent');

const app = express();
app.set('trust proxy', 1); // Railway sits behind a proxy — required for express-rate-limit
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
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Seed files (committed to git)
const COURSE_SEED_PATH = path.join(__dirname, '../course_data.json');
const QUIZ_SEED_PATH = path.join(__dirname, '../quiz_data.json');

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
  `);

  const courseCheck = await pool.query('SELECT id FROM course_data WHERE id = 1');
  const jsonCourseData = JSON.parse(fs.readFileSync(COURSE_SEED_PATH, 'utf8'));
  if (courseCheck.rowCount === 0) {
    console.log('[boot] Seeding course_data from committed file');
    await pool.query('INSERT INTO course_data (id, data) VALUES (1, $1)', [JSON.stringify(jsonCourseData)]);
  } else {
    // Merge: use JSON order, keep DB version of existing modules (preserves admin edits), add new ones
    const dbResult = await pool.query('SELECT data FROM course_data WHERE id = 1');
    const dbModules = dbResult.rows[0].data;
    const dbMap = new Map(dbModules.map(m => [m.id, m]));
    const jsonIds = new Set(jsonCourseData.map(m => m.id));
    const newIds = jsonCourseData.filter(m => !dbMap.has(m.id)).map(m => m.id);
    if (newIds.length > 0) {
      console.log(`[boot] Adding ${newIds.length} new module(s) from JSON:`, newIds);
      // Follow JSON order; for existing modules use DB copy, for new ones use JSON copy
      const merged = jsonCourseData.map(m => dbMap.get(m.id) || m);
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

  console.log('[boot] DB ready');
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function getCourseData() {
  const r = await pool.query('SELECT data FROM course_data WHERE id = 1');
  return r.rows[0]?.data;
}
async function setCourseData(data) {
  await pool.query(
    'INSERT INTO course_data (id, data, updated_at) VALUES (1, $1, NOW()) ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()',
    [JSON.stringify(data)]
  );
}
async function getQuizData() {
  const r = await pool.query('SELECT data FROM quiz_data WHERE id = 1');
  return r.rows[0]?.data;
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

// ─── Serve React build ────────────────────────────────────────────────────────
const BUILD_DIR = path.join(__dirname, '../client/build');
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
app.get('/api/course', async (req, res) => {
  try {
    res.json(await getCourseData());
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

// ─── User login: username + password ─────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const r = await pool.query(
    'SELECT email, name, assigned_modules FROM roster WHERE LOWER(username) = LOWER($1) AND password = $2',
    [username.trim(), password.trim()]
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
initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`WISH Course running on port ${PORT}`));
    agent.start(pool);
  })
  .catch(err => { console.error('[boot] DB init failed:', err); process.exit(1); });
