require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

// ─── Serve React build + audio files ─────────────────────────────────────────
const BUILD_DIR = path.join(__dirname, '../client/build');
app.use(express.static(BUILD_DIR));

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
    path: `/v1/text-to-speech/${VOICE_ID}`,
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const elReq = https.request(options, (elRes) => {
    if (elRes.statusCode !== 200) {
      res.status(502).json({ error: 'ElevenLabs error', status: elRes.statusCode });
      return;
    }
    res.set('Content-Type', 'audio/mpeg');
    elRes.pipe(res);
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
app.get('*', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`WISH Course running on port ${PORT}`);
});
