require('dotenv').config({ path: '../server/.env' });
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AUDIO_DIR = path.join(__dirname, '../client/public/audio');
const courseData = require('../client/src/data/course_data.json');

if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not set');
  process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function transcribeWithTimestamps(mp3Path) {
  return new Promise((resolve, reject) => {
    const mp3Data = fs.readFileSync(mp3Path);
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`),
      mp3Data,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\nword\r\n`),
      Buffer.from(`--${boundary}--\r\n`),
    ]);

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Whisper ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse Whisper response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  let total = 0;
  let done = 0;
  let skipped = 0;
  let errors = 0;

  for (const mod of courseData) {
    for (const slide of mod.slides) {
      const mp3 = path.join(AUDIO_DIR, mod.id, `slide_${slide.original_index}.mp3`);
      if (fs.existsSync(mp3)) total++;
    }
  }

  console.log(`\n🎙  Generating word timings via Whisper`);
  console.log(`Total audio files: ${total}\n`);

  for (const mod of courseData) {
    for (const slide of mod.slides) {
      if (!slide.text || !slide.text.trim()) continue;

      const mp3Path = path.join(AUDIO_DIR, mod.id, `slide_${slide.original_index}.mp3`);
      const timingPath = path.join(AUDIO_DIR, mod.id, `slide_${slide.original_index}.json`);

      if (!fs.existsSync(mp3Path)) continue;

      if (fs.existsSync(timingPath)) {
        skipped++;
        process.stdout.write(`  SKIP  ${mod.name} › ${slide.slide_name}\n`);
        continue;
      }

      process.stdout.write(`  GEN   ${mod.name} › ${slide.slide_name}...`);

      try {
        const result = await transcribeWithTimestamps(mp3Path);
        const words = (result.words || []).map((w) => ({
          word: w.word,
          start: w.start,
          end: w.end,
        }));
        fs.writeFileSync(timingPath, JSON.stringify(words, null, 2));
        done++;
        process.stdout.write(` ✓ (${words.length} words)\n`);
      } catch (err) {
        errors++;
        process.stdout.write(` ✗ ${err.message.slice(0, 80)}\n`);
      }

      await sleep(300);
    }
  }

  console.log(`\n✅ Done! Generated: ${done}, Skipped: ${skipped}, Errors: ${errors}`);
}

main();
