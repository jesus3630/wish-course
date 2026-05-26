/**
 * seed-narration-cache.js
 *
 * One-time script: reads all {hash}.json + {hash}.mp3 files from client/build/audio/,
 * matches them to slides in course_data.json, then inserts into narration_cache
 * in Railway PostgreSQL using the SERVER hash (sha256(VOICE_ID + ":" + text)).
 *
 * Run: DATABASE_URL=<public_url> VOICE_ID=<id> node scripts/seed-narration-cache.js
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const VOICE_ID      = process.env.VOICE_ID || 'Znoc6pjc2kSb9hIuR7XU';
const DATABASE_URL  = process.env.DATABASE_URL;
const AUDIO_DIR     = path.join(__dirname, '../client/build/audio');
const COURSE_FILE   = path.join(__dirname, '../course_data.json');

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Client hash: sha256 of text.trim() — matches static filename
function clientHash(text) {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

// Server hash: sha256 of voiceId + ":" + text — matches narration_cache lookup
function serverHash(text) {
  return crypto.createHash('sha256').update(`${VOICE_ID}:${text.trim()}`).digest('hex');
}

async function main() {
  const courseData = JSON.parse(fs.readFileSync(COURSE_FILE, 'utf8'));

  // Collect all slide texts
  const slides = [];
  for (const mod of courseData) {
    for (const slide of mod.slides || []) {
      const text = (slide.text || '').trim();
      if (!text) continue;
      slides.push({ modId: mod.id, text });
    }
  }

  console.log(`Found ${slides.length} slides with text`);
  let inserted = 0, skipped = 0, missing = 0;

  for (const { modId, text } of slides) {
    const cHash = clientHash(text);
    const sHash = serverHash(text);

    const jsonPath = path.join(AUDIO_DIR, `${cHash}.json`);
    const mp3Path  = path.join(AUDIO_DIR, `${cHash}.mp3`);

    if (!fs.existsSync(jsonPath) || !fs.existsSync(mp3Path)) {
      console.log(`  MISSING: ${modId} — ${text.substring(0, 40)}...`);
      missing++;
      continue;
    }

    const timings  = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const mp3B64   = fs.readFileSync(mp3Path).toString('base64');

    // Check if already in narration_cache
    const existing = await pool.query(
      'SELECT 1 FROM narration_cache WHERE text_hash = $1', [sHash]
    );
    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO narration_cache (text_hash, audio, timings) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [sHash, mp3B64, JSON.stringify(timings)]
      );
      inserted++;
      console.log(`  Seeded narration_cache: ${modId} — ${text.substring(0, 50)}...`);
    } else {
      skipped++;
    }

    // Always ensure client_timings is populated (the key table for /audio/{hash}.json)
    const ctExisting = await pool.query(
      'SELECT 1 FROM client_timings WHERE client_hash = $1', [cHash]
    );
    if (ctExisting.rows.length === 0) {
      await pool.query(
        'INSERT INTO client_timings (client_hash, timings) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [cHash, JSON.stringify(timings)]
      );
      console.log(`  Seeded client_timings: ${modId} — ${text.substring(0, 50)}...`);
    }
  }

  console.log(`\nDone — inserted: ${inserted}, skipped (already existed): ${skipped}, missing files: ${missing}`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
