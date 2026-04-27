require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'wish-admin';

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
  `);

  const courseCheck = await pool.query('SELECT id FROM course_data WHERE id = 1');
  if (courseCheck.rowCount === 0) {
    console.log('[boot] Seeding course_data from committed file');
    const courseData = JSON.parse(fs.readFileSync(COURSE_SEED_PATH, 'utf8'));
    await pool.query('INSERT INTO course_data (id, data) VALUES (1, $1)', [JSON.stringify(courseData)]);
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

// ─── Serve React build ────────────────────────────────────────────────────────
const BUILD_DIR = path.join(__dirname, '../client/build');
app.use(express.static(BUILD_DIR));

// ─── Serve local video clips (local-only; not committed to git) ───────────────
const CLIPS_DIR = path.join(__dirname, '../video_processing/clips');
app.use('/clips', express.static(CLIPS_DIR));

// ─── Serve per-slide screenshots (local-only; not committed to git) ───────────
const SCREENSHOTS_DIR = path.join(__dirname, '../video_processing/screenshots');
app.use('/screenshots', express.static(SCREENSHOTS_DIR));

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
function adminAuth(req, res, next) {
  const pw = req.headers['x-admin-password'] || (req.body && req.body.password);
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ─── Admin: login check ───────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
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

  const body = JSON.stringify({
    text: text.substring(0, 5000),
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
    await pool.query(
      'INSERT INTO user_progress (email, data, last_synced) VALUES ($1, $2, NOW()) ON CONFLICT (email) DO UPDATE SET data = $2, last_synced = NOW()',
      [email, JSON.stringify(progress)]
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

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── All other routes → React app ─────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
initDB()
  .then(() => app.listen(PORT, () => console.log(`WISH Course running on port ${PORT}`)))
  .catch(err => { console.error('[boot] DB init failed:', err); process.exit(1); });
