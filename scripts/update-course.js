#!/usr/bin/env node
/**
 * Rebuild course_data.json from the WISH storyboard Excel.
 *
 * Usage:
 *   node scripts/update-course.js                        # auto-picks latest MARKED_2*.xlsx in ~/Downloads
 *   node scripts/update-course.js path/to/storyboard.xlsx
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const os = require('os');

const SHEET_TO_ID = {
  'Introduction': 'introduction',
  'Record Maintenance': 'record_maintenance',
  'Manage Job': 'manage_job',
  'MSS': 'mss',
  'Scheduling': 'scheduling',
  'Schedule By Job Admin': 'schedule_by_job_admin',
  'General Reporting': 'general_reporting',
  'Payroll Reporting': 'payroll_reporting',
  'Admin Reporting': 'admin_reporting',
  'Workforce Scheduler Mntnnce': 'workforce_scheduler_mntnnce',
  'Workforce Admin Maintenance': 'workforce_admin_maintenance',
  'Employee HR Record Maintenance': 'employee_hr_record_maintenance',
  'Hiring Manager': 'hiring_manager',
  'Hiring Admin': 'hiring_admin',
  'Mail By': 'mail_by',
  'Sign-In  Sign-Out': 'sign-in__sign-out',
  'Manual Process Hours': 'manual_process_hours',
  'Billing': 'billing',
  'Payroll Processing': 'payroll_processing',
};

const SHEET_TO_NAME = {
  'Introduction': 'Introduction',
  'Record Maintenance': 'Record Maintenance',
  'Manage Job': 'Manage Job',
  'MSS': 'MSS',
  'Scheduling': 'Scheduling',
  'Schedule By Job Admin': 'Schedule By Job Admin',
  'General Reporting': 'General Reporting',
  'Payroll Reporting': 'Payroll Reporting',
  'Admin Reporting': 'Admin Reporting',
  'Workforce Scheduler Mntnnce': 'Workforce Scheduler Maintenance',
  'Workforce Admin Maintenance': 'Workforce Admin Maintenance',
  'Employee HR Record Maintenance': 'Employee HR Record Maintenance',
  'Hiring Manager': 'Hiring Manager',
  'Hiring Admin': 'Hiring Admin',
  'Mail By': 'Mail By',
  'Sign-In  Sign-Out': 'Sign-In / Sign-Out',
  'Manual Process Hours': 'Manual Process Hours',
  'Billing': 'Billing',
  'Payroll Processing': 'Payroll Processing',
};

function findLatestExcel() {
  const downloads = path.join(os.homedir(), 'Downloads');
  const files = fs.readdirSync(downloads)
    .filter(f => f.startsWith('WISH_Automation_Storyboard_MARKED_2') && f.endsWith('.xlsx') && !f.startsWith('~$'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(downloads, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) throw new Error('No WISH_Automation_Storyboard_MARKED_2*.xlsx found in ~/Downloads');
  return path.join(downloads, files[0].name);
}

const excelPath = process.argv[2] || findLatestExcel();
const outPath = path.join(__dirname, '../course_data.json');

console.log(`Reading: ${excelPath}`);

const wb = XLSX.readFile(excelPath);

// Load existing data to show diff
let oldCounts = {};
if (fs.existsSync(outPath)) {
  try {
    const old = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    old.forEach(m => { oldCounts[m.id] = m.slides.length; });
  } catch (_) {}
}

const modules = [];
for (const sheetName of wb.SheetNames) {
  if (sheetName === 'WISH User Permissions') continue;
  if (!SHEET_TO_ID[sheetName]) {
    console.warn(`  WARNING: Unmapped sheet "${sheetName}" — skipping`);
    continue;
  }

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const slides = [];
  for (const row of rows) {
    const [slideNum, slideName, instructions, text] = row;
    if (typeof slideNum !== 'number' || !Number.isInteger(slideNum)) continue;
    slides.push({
      slide_number: slideNum,
      slide_name: String(slideName || '').trim(),
      instructions: String(instructions || '').trim(),
      text: String(text || '').trim(),
    });
  }

  const id = SHEET_TO_ID[sheetName];
  const oldCount = oldCounts[id];
  const diff = oldCount !== undefined ? ` (was ${oldCount}, ${slides.length > oldCount ? '+' : ''}${slides.length - oldCount})` : '';
  console.log(`  ${sheetName}: ${slides.length} slides${diff}`);

  modules.push({ id, name: SHEET_TO_NAME[sheetName], slides });
}

fs.writeFileSync(outPath, JSON.stringify(modules, null, 2), 'utf8');
console.log(`\nWrote ${modules.length} modules → course_data.json`);
console.log('\nNext steps:');
console.log('  git add course_data.json && git commit -m "chore: update course data from storyboard"');
console.log('  railway up --detach');
