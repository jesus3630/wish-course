require('dotenv').config({ path: '../server/.env' });
const https = require('https');
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const courseData = require('../client/src/data/course_data.json');
const OUTPUT_DIR = path.join(__dirname, '../client/public/audio');

if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not set in server/.env');
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateAudio(text, outputPath) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'tts-1-hd',
      input: text.substring(0, 4096),
      voice: 'nova', // Professional, clear female voice
      response_format: 'mp3',
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/audio/speech',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', d => errData += d);
        res.on('end', () => reject(new Error(`OpenAI ${res.statusCode}: ${errData}`)));
        return;
      }
      const file = fs.createWriteStream(outputPath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  let total = 0;
  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const mod of courseData) {
    for (const slide of mod.slides) {
      if (slide.text && slide.text.trim()) total++;
    }
  }

  console.log(`\n🎙  WISH Audio Generation — OpenAI TTS (tts-1-hd, nova)`);
  console.log(`Total slides with narration: ${total}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  let count = 0;
  for (const mod of courseData) {
    const modDir = path.join(OUTPUT_DIR, mod.id);
    fs.mkdirSync(modDir, { recursive: true });

    for (let i = 0; i < mod.slides.length; i++) {
      const slide = mod.slides[i];
      if (!slide.text || !slide.text.trim()) continue;

      count++;
      const outputPath = path.join(modDir, `slide_${i}.mp3`);

      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
        skipped++;
        process.stdout.write(`  [${count}/${total}] SKIP  ${mod.name} › Slide ${i + 1}\n`);
        continue;
      }

      process.stdout.write(`  [${count}/${total}] GEN   ${mod.name} › Slide ${i + 1} — ${slide.slide_name || ''}...`);

      try {
        await generateAudio(slide.text, outputPath);
        generated++;
        process.stdout.write(` ✓\n`);
      } catch (err) {
        errors++;
        process.stdout.write(` ✗ ${err.message}\n`);
      }

      await sleep(200);
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Generated: ${generated}`);
  console.log(`   Skipped:   ${skipped}`);
  console.log(`   Errors:    ${errors}`);
  console.log(`\nAudio files saved to: ${OUTPUT_DIR}`);
}

main();
