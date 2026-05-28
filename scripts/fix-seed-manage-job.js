// Fix garbled bullet points in course_data.json seed file for manage_job slides
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'course_data.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const bullet = '•'; // •
const mod = data.find(m => m.id === 'manage_job');

// Slide index 1 — "Manage Job" overview
mod.slides[1].text = `In this module, you will learn:\n${bullet} How to create a Job\n${bullet} How to modify an existing Job\n${bullet} How to copy a Job\n${bullet} How to delete a Job (and why order matters)\n\nNote: If you have Record Maintenance access, this module is included within that permission. Manage Job is for users who create and modify jobs only.`;

// Slide index 2 — "Creating a Job"
mod.slides[2].text = `Go to Records to Manage Job. Use the filter page to search for existing jobs by name or job number. To create a new job, click Add New.\n\nFill in all asterisk-marked fields:\n${bullet} Job Name\n${bullet} Job Class, use Events for jobs you will schedule employees for and bill a client; Office for in-office hours; Training for training shifts\n${bullet} Branch Name, auto-fills for you\n${bullet} Event, select the event from the dropdown\n${bullet} Venue and Client, these auto-populate from the event\n${bullet} Start and End Date/Time, use military time format\n\nAfter saving, copy the job number to your clipboard, you will use it throughout the system.`;
mod.slides[2].instructions = 'Screen recording: Records > Manage Job. Click Add New. Fill required fields. Save. Show green confirmation and job number.';

// Slide index 4 — "Copying a Job"
mod.slides[4].text = `From Manage Job search results, click the copy icon for the job you want to copy. Open the copy settings link.\n\nChoose from:\n${bullet} Daily, copies the job to specific dates\n${bullet} Weekly, repeats on the same days of the week over a date range\n${bullet} Monthly, copies for every day of the month\n\nDaily is the most commonly used option. Always double-check your start and end dates before confirming, do not include the original date again. Copied jobs receive new unique job numbers.`;

fs.writeFileSync(filePath, JSON.stringify(data, null, 4), { encoding: 'utf8' });

// Verify
const verify = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const vMod = verify.find(m => m.id === 'manage_job');
[1, 2, 4].forEach(i => {
  const text = vMod.slides[i].text;
  const idx = text.search(/•/);
  const code = idx >= 0 ? text.codePointAt(idx).toString(16).toUpperCase() : 'NOT FOUND';
  console.log(`Slide ${i} bullet: U+${code} ${code === '2022' ? '✓' : '✗'}`);
});
console.log('Done.');
