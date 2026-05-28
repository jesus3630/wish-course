const https = require('https');

https.get('https://wish-app-production.up.railway.app/api/course', (res) => {
  let chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    const data = JSON.parse(raw);
    const mod = data.find(m => m.id === 'manage_job');

    // Allow common smart quotes + bullet + dashes
    const ALLOWED = new Set([0x2022, 0x2019, 0x2018, 0x201C, 0x201D, 0x2013, 0x2014, 0x2026]);

    mod.slides.forEach((slide, i) => {
      ['text', 'instructions', 'slide_name'].forEach(field => {
        const val = slide[field] || '';
        let bad = [];
        for (let j = 0; j < val.length; j++) {
          const code = val.codePointAt(j);
          if (code > 127 && !ALLOWED.has(code)) {
            bad.push('U+' + code.toString(16).toUpperCase());
          }
        }
        if (bad.length) {
          console.log(`Slide ${i} [${slide.slide_name}] ${field}: BAD: ${[...new Set(bad)].join(', ')}`);
          // Show context
          for (let j = 0; j < val.length; j++) {
            const code = val.codePointAt(j);
            if (code > 127 && !ALLOWED.has(code)) {
              console.log(`  pos ${j}: "${val.substring(Math.max(0,j-10), j+20).replace(/\n/g,'\\n')}"`);
              break;
            }
          }
        }
      });
    });
    console.log('\nDone.');
  });
});
