/**
 * Pre-generate ElevenLabs narration for every slide across all modules.
 * Files are named by SHA-256 of the slide text so admin edits automatically
 * invalidate the cache — changed text = new hash = static miss = fresh API call.
 *
 * Saves: client/public/audio/{sha256}.mp3
 *        client/public/audio/{sha256}.json  (word timings)
 * Skips hashes whose MP3 already exists and is > 1 KB.
 *
 * Usage (from project root):
 *   node scripts/pregen-audio.js               # all modules
 *   node scripts/pregen-audio.js --module introduction
 *   node scripts/pregen-audio.js --dry-run     # preview chars/slides, no API calls
 */

require('dotenv').config({ path: 'server/.env' });
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API_KEY  = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
const OUTPUT   = path.join(__dirname, '../client/public/audio');
const DATA_FILE = path.join(__dirname, '../course_data.json');

const DELAY_MS = 2500;

if (!API_KEY) {
  console.error('ERROR: ELEVENLABS_API_KEY not set in server/.env');
  process.exit(1);
}

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const modFlag  = args.indexOf('--module');
const MOD_ONLY = modFlag !== -1 ? args[modFlag + 1] : null;

const courseData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const modules    = MOD_ONLY ? courseData.filter(m => m.id === MOD_ONLY) : courseData;

if (MOD_ONLY && modules.length === 0) {
  const ids = courseData.map(m => m.id).join(', ');
  console.error(`ERROR: module "${MOD_ONLY}" not found.\nAvailable: ${ids}`);
  process.exit(1);
}

function textHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseTimings(alignment) {
  const chars  = alignment?.characters ?? [];
  const starts = alignment?.character_start_times_seconds ?? [];
  const ends   = alignment?.character_end_times_seconds ?? [];

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
  return timings;
}

function callElevenLabs(text) {
  return new Promise((resolve, reject) => {
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
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`ElevenLabs ${res.statusCode}: ${raw.substring(0, 200)}`));
        }
        try {
          const data = JSON.parse(raw);
          resolve({
            audio_base64: data.audio_base64,
            timings: parseTimings(data.alignment),
          });
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  let total = 0, totalChars = 0;
  for (const mod of modules) {
    for (const slide of mod.slides) {
      if (slide.text?.trim()) { total++; totalChars += slide.text.trim().length; }
    }
  }

  console.log(`\nElevenLabs Pre-Generation — voice ${VOICE_ID}`);
  console.log(`Naming: SHA-256 of slide text (admin edits auto-invalidate)`);
  if (MOD_ONLY) console.log(`Module filter     : ${MOD_ONLY}`);
  if (DRY_RUN)  console.log(`Mode              : DRY RUN (no API calls)`);
  console.log(`Slides to narrate : ${total}`);
  console.log(`Est. characters   : ${totalChars.toLocaleString()}`);
  console.log(`Output dir        : ${OUTPUT}`);
  if (!DRY_RUN) console.log(`Delay per request : ${DELAY_MS}ms`);
  console.log();

  if (DRY_RUN) {
    console.log('Module breakdown:');
    for (const mod of modules) {
      let mSlides = 0, mChars = 0;
      for (const s of mod.slides) { if (s.text?.trim()) { mSlides++; mChars += s.text.trim().length; } }
      console.log(`  ${mod.id.padEnd(30)} ${String(mSlides).padStart(3)} slides  ${mChars.toLocaleString().padStart(7)} chars`);
    }
    return;
  }

  fs.mkdirSync(OUTPUT, { recursive: true });

  let count = 0, generated = 0, skipped = 0, errors = 0, charsSent = 0;

  for (const mod of modules) {
    for (let i = 0; i < mod.slides.length; i++) {
      const slide = mod.slides[i];
      if (!slide.text?.trim()) continue;

      count++;
      const text     = slide.text.trim();
      const hash     = textHash(text);
      const mp3Path  = path.join(OUTPUT, `${hash}.mp3`);
      const jsonPath = path.join(OUTPUT, `${hash}.json`);
      const label    = `[${String(count).padStart(3)}/${total}]  ${mod.id} › slide ${i}`;

      try {
        if (fs.statSync(mp3Path).size > 1000) {
          skipped++;
          console.log(`SKIP  ${label}  (${hash.slice(0, 8)}…)`);
          continue;
        }
      } catch {}

      process.stdout.write(`GEN   ${label}  (${hash.slice(0, 8)}…) ...`);
      try {
        const { audio_base64, timings } = await callElevenLabs(text);

        fs.writeFileSync(mp3Path, Buffer.from(audio_base64, 'base64'));
        fs.writeFileSync(jsonPath, JSON.stringify(timings, null, 2));

        charsSent += text.length;
        generated++;
        console.log(` OK  (${timings.length} words, ${(fs.statSync(mp3Path).size / 1024).toFixed(1)} KB)`);
      } catch (err) {
        errors++;
        console.log(` FAIL  ${err.message}`);
      }

      if (count < total) await sleep(DELAY_MS);
    }
  }

  console.log(`\nDone.`);
  console.log(`  Generated : ${generated}`);
  console.log(`  Skipped   : ${skipped}`);
  console.log(`  Errors    : ${errors}`);
  console.log(`  Chars sent: ${charsSent.toLocaleString()}`);
}

main();
