// Fix garbled bullet points in manage_job slides via PATCH API
// Uses Node.js https module to avoid bash/terminal encoding issues

const https = require('https');

const ADMIN_PASSWORD = 'fJ7uZ_Xzi-y8Y3wI';
const BASE_URL = 'wish-app-production.up.railway.app';

const bullet = '•'; // •

const slides = [
  {
    slideIndex: 1,
    fields: {
      text: `In this module, you will learn:\n${bullet} How to create a Job\n${bullet} How to modify an existing Job\n${bullet} How to copy a Job\n${bullet} How to delete a Job (and why order matters)\n\nNote: If you have Record Maintenance access, this module is included within that permission. Manage Job is for users who create and modify jobs only.`
    }
  },
  {
    slideIndex: 2,
    fields: {
      instructions: 'Screen recording: Records > Manage Job. Click Add New. Fill required fields. Save. Show green confirmation and job number.',
      text: `Go to Records to Manage Job. Use the filter page to search for existing jobs by name or job number. To create a new job, click Add New.\n\nFill in all asterisk-marked fields:\n${bullet} Job Name\n${bullet} Job Class, use Events for jobs you will schedule employees for and bill a client; Office for in-office hours; Training for training shifts\n${bullet} Branch Name, auto-fills for you\n${bullet} Event, select the event from the dropdown\n${bullet} Venue and Client, these auto-populate from the event\n${bullet} Start and End Date/Time, use military time format\n\nAfter saving, copy the job number to your clipboard, you will use it throughout the system.`
    }
  },
  {
    slideIndex: 4,
    fields: {
      text: `From Manage Job search results, click the copy icon for the job you want to copy. Open the copy settings link.\n\nChoose from:\n${bullet} Daily, copies the job to specific dates\n${bullet} Weekly, repeats on the same days of the week over a date range\n${bullet} Monthly, copies for every day of the month\n\nDaily is the most commonly used option. Always double-check your start and end dates before confirming, do not include the original date again. Copied jobs receive new unique job numbers.`
    }
  }
];

function patch(slideIndex, fields) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ moduleId: 'manage_job', slideIndex, fields });
    const options = {
      hostname: BASE_URL,
      path: '/api/admin/slide',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': ADMIN_PASSWORD,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ slideIndex, ok: json.ok, text: json.updated?.text?.substring(0, 80) });
        } catch (e) {
          resolve({ slideIndex, ok: false, raw: data.substring(0, 200) });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  for (const { slideIndex, fields } of slides) {
    try {
      const result = await patch(slideIndex, fields);
      console.log(`Slide ${slideIndex}: ok=${result.ok}`);
      if (result.text) console.log(`  preview: ${result.text}`);
      if (result.raw) console.log(`  raw: ${result.raw}`);
    } catch (e) {
      console.error(`Slide ${slideIndex} FAILED:`, e.message);
    }
  }

  // Verify - fetch and check bullets
  console.log('\n--- Verifying ---');
  https.get(`https://${BASE_URL}/api/course`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const course = JSON.parse(data);
      const mod = course.find(m => m.id === 'manage_job');
      [1, 2, 4].forEach(i => {
        const slide = mod.slides[i];
        const text = slide.text || '';
        const idx = text.indexOf('How to create') > -1 ? text.indexOf('How to create') - 3
                  : text.indexOf('Job Name') > -1 ? text.indexOf('Job Name') - 3
                  : text.indexOf('Daily') > -1 ? text.indexOf('Daily') - 3
                  : -1;
        if (idx >= 0) {
          const bulletChar = text[idx];
          const code = bulletChar.codePointAt(0).toString(16);
          console.log(`Slide ${i} bullet: U+${code.toUpperCase()} ${code === '2022' ? '✓ CORRECT' : '✗ WRONG (expected 2022)'}`);
        }
      });
    });
  });
}

main().catch(console.error);
