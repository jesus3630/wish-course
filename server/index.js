require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'wish-admin';

const COURSE_DATA_PATH = path.join(__dirname, '../course_data.json');
const QUIZ_DATA_PATH = path.join(__dirname, '../quiz_data.json');

// ─── Serve React build + audio files ─────────────────────────────────────────
const BUILD_DIR = path.join(__dirname, '../client/build');
app.use(express.static(BUILD_DIR));

// ─── Public: course data ──────────────────────────────────────────────────────
app.get('/api/course', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(COURSE_DATA_PATH, 'utf8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load course data' });
  }
});

// ─── Public: quiz data ────────────────────────────────────────────────────────
app.get('/api/quiz', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(QUIZ_DATA_PATH, 'utf8'));
    res.json(data);
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

// ─── Admin: update course data ────────────────────────────────────────────────
app.put('/api/admin/course', adminAuth, (req, res) => {
  try {
    fs.writeFileSync(COURSE_DATA_PATH, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to save course data:', e);
    res.status(500).json({ error: 'Failed to save course data' });
  }
});

// ─── Admin: update quiz data ──────────────────────────────────────────────────
app.put('/api/admin/quiz', adminAuth, (req, res) => {
  try {
    fs.writeFileSync(QUIZ_DATA_PATH, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to save quiz data:', e);
    res.status(500).json({ error: 'Failed to save quiz data' });
  }
});

// ─── Narration endpoint ───────────────────────────────────────────────────────
app.post('/api/narrate', async (req, res) => {
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
        // Convert character-level alignment to word-level timings
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
const progressStore = new Map();

app.post('/api/progress', (req, res) => {
  const { email, progress } = req.body;
  if (!email || !progress) return res.status(400).json({ error: 'Missing fields' });
  progressStore.set(email, { ...progress, last_synced: new Date().toISOString() });
  res.json({ ok: true });
});

app.get('/api/progress/:email', (req, res) => {
  const data = progressStore.get(req.params.email);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── All other routes → React app ─────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`WISH Course running on port ${PORT}`);
});
