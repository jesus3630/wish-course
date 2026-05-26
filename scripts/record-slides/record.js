#!/usr/bin/env node
// Records WISH system slides using a saved browser session.
// Run save-session.js once first to log in and save session.json.
//
// Usage:
//   node record.js                          # all slides
//   node record.js --module scheduling      # one module
//   node record.js --module scheduling --slide 3

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const PROFILE_DIR = path.join(__dirname, 'browser-profile');
const WISH_URL = 'https://wish.schedulingsite.com';
const OUTPUT_DIR = path.resolve(__dirname, '../../client/public/videos');

if (!fs.existsSync(PROFILE_DIR)) {
  console.error('No browser profile found. Run:  node save-session.js');
  process.exit(1);
}

// Slide definitions: module, slide#, menu path to navigate, actions, duration
const SLIDES = [
  {
    module: 'manage_job', slide: 3,
    path: ['Records', 'Manage Job'],
    actions: [
      { type: 'wait', ms: 1200 },
      { type: 'click_text', text: 'Add New' },
      { type: 'wait', ms: 1000 },
      { type: 'fill_visible', label: 'Job Name', value: 'DRAKE N3' },
      { type: 'wait', ms: 600 },
      { type: 'click_text', text: 'Save' },
      { type: 'wait', ms: 1500 },
    ],
    duration: 14000,
  },
  {
    module: 'manage_job', slide: 4,
    path: ['Records', 'Manage Job'],
    actions: [
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Shifts' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Add New' },
      { type: 'wait', ms: 600 },
      { type: 'click_text', text: 'Add Role' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Save' },
      { type: 'wait', ms: 1200 },
    ],
    duration: 14000,
  },
  {
    module: 'manage_job', slide: 5,
    path: ['Records', 'Manage Job'],
    actions: [
      { type: 'wait', ms: 1200 },
      { type: 'click_selector', selector: '[title*="Copy"], [class*="copy"]' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Daily' },
      { type: 'wait', ms: 600 },
      { type: 'click_text', text: 'Copy' },
      { type: 'wait', ms: 1500 },
    ],
    duration: 12000,
  },
  {
    module: 'mss', slide: 3,
    path: ['Tools', 'Manager Portal'],
    actions: [{ type: 'wait', ms: 3000 }],
    duration: 10000,
  },
  {
    module: 'mss', slide: 4,
    path: ['Tools', 'Manager Portal'],
    actions: [
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Web Shift' },
      { type: 'wait', ms: 1200 },
      { type: 'click_text', text: 'Add to Web Shift' },
      { type: 'wait', ms: 1500 },
    ],
    duration: 12000,
  },
  {
    module: 'mss', slide: 6,
    path: ['Tools', 'Manager Portal'],
    actions: [
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Web Shift Approval' },
      { type: 'wait', ms: 2000 },
    ],
    duration: 10000,
  },
  {
    module: 'scheduling', slide: 3,
    path: ['Scheduling', 'Schedule by Employee'],
    actions: [
      { type: 'wait', ms: 1500 },
      { type: 'fill_selector', selector: 'input[placeholder*="mployee"], input[placeholder*="ast"], input[placeholder*="earch"]', value: 'Smith' },
      { type: 'wait', ms: 600 },
      { type: 'click_text', text: 'Search' },
      { type: 'wait', ms: 1500 },
    ],
    duration: 14000,
  },
  {
    module: 'scheduling', slide: 4,
    path: ['Scheduling', 'Schedule by Job'],
    actions: [
      { type: 'wait', ms: 1500 },
      { type: 'fill_selector', selector: 'input[placeholder*="ob"], input[placeholder*="umber"]', value: '12345' },
      { type: 'wait', ms: 600 },
      { type: 'click_text', text: 'Search' },
      { type: 'wait', ms: 1500 },
      { type: 'click_text', text: 'Save' },
      { type: 'wait', ms: 1200 },
    ],
    duration: 14000,
  },
  {
    module: 'schedule_by_job_admin', slide: 4,
    path: ['Scheduling', 'Schedule by Job Admin'],
    actions: [
      { type: 'wait', ms: 1200 },
      { type: 'click_text', text: 'Search' },
      { type: 'wait', ms: 1500 },
      { type: 'click_text', text: 'Save' },
      { type: 'wait', ms: 1500 },
    ],
    duration: 14000,
  },
  {
    module: 'general_reporting', slide: 3,
    path: ['Reports', 'Job Administration'],
    actions: [{ type: 'wait', ms: 3000 }],
    duration: 10000,
  },
  {
    module: 'payroll_reporting', slide: 3,
    path: ['Reports'],
    actions: [{ type: 'wait', ms: 3000 }],
    duration: 10000,
  },
  {
    module: 'admin_reporting', slide: 3,
    path: ['Reports'],
    actions: [{ type: 'wait', ms: 3000 }],
    duration: 10000,
  },
  {
    module: 'workforce_scheduler_mntnnce', slide: 3,
    path: ['Records', 'Manage Employee'],
    actions: [
      { type: 'wait', ms: 800 },
      { type: 'fill_selector', selector: 'input[name*="Last"], input[placeholder*="Last"], input[placeholder*="last"]', value: 'Gonzalez' },
      { type: 'wait', ms: 600 },
      { type: 'click_text', text: 'Search' },
      { type: 'wait', ms: 1200 },
      { type: 'click_first_link', selector: 'td a' },
      { type: 'wait', ms: 1000 },
      { type: 'click_text', text: 'Personal Info' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Licensing' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Background Check' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Employee Notes' },
      { type: 'wait', ms: 800 },
    ],
    duration: 18000,
  },
  {
    module: 'workforce_admin_maintenance', slide: 3,
    path: ['Records', 'Manage Employee'],
    actions: [
      { type: 'wait', ms: 800 },
      { type: 'fill_selector', selector: 'input[name*="Last"], input[placeholder*="Last"]', value: 'Gonzalez' },
      { type: 'wait', ms: 600 },
      { type: 'click_text', text: 'Search' },
      { type: 'wait', ms: 1200 },
      { type: 'click_first_link', selector: 'td a' },
      { type: 'wait', ms: 1000 },
      { type: 'click_text', text: 'Disciplinary Action' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Pay Rate' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Training' },
      { type: 'wait', ms: 800 },
    ],
    duration: 16000,
  },
  {
    module: 'employee_hr_record_maintenance', slide: 3,
    path: ['Records', 'Manage Employee'],
    actions: [
      { type: 'wait', ms: 800 },
      { type: 'fill_selector', selector: 'input[name*="Last"], input[placeholder*="Last"]', value: 'Gonzalez' },
      { type: 'wait', ms: 600 },
      { type: 'click_text', text: 'Search' },
      { type: 'wait', ms: 1200 },
      { type: 'click_first_link', selector: 'td a' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Email' },
      { type: 'wait', ms: 700 },
      { type: 'click_text', text: 'Phone' },
      { type: 'wait', ms: 700 },
      { type: 'click_text', text: 'Pay Rate' },
      { type: 'wait', ms: 700 },
      { type: 'click_text', text: 'Background Check' },
      { type: 'wait', ms: 700 },
      { type: 'click_text', text: 'Tasks' },
      { type: 'wait', ms: 800 },
    ],
    duration: 20000,
  },
  {
    module: 'employee_hr_record_maintenance', slide: 4,
    path: ['Records', 'Manage Employee'],
    actions: [
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Search' },
      { type: 'wait', ms: 1500 },
    ],
    duration: 12000,
  },
  {
    module: 'hiring_manager', slide: 3,
    path: ['Tools', 'Import from Hiring Portal'],
    actions: [{ type: 'wait', ms: 3000 }],
    duration: 12000,
  },
  {
    module: 'hiring_admin', slide: 3,
    path: ['Records', 'Manage Employee'],
    actions: [
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Search' },
      { type: 'wait', ms: 1200 },
      { type: 'click_first_link', selector: 'td a' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Tasks' },
      { type: 'wait', ms: 1500 },
    ],
    duration: 14000,
  },
  {
    module: 'mail_by', slide: 3,
    path: ['Scheduling'],
    actions: [
      { type: 'wait', ms: 1000 },
      { type: 'click_text', text: 'Mail By Employee' },
      { type: 'wait', ms: 2000 },
    ],
    duration: 12000,
  },
  {
    module: 'sign_in_sign_out', slide: 3,
    path: ['Time Clock', 'Sign-In Config'],
    actions: [
      { type: 'wait', ms: 1200 },
      { type: 'click_text', text: 'Add to Shift List' },
      { type: 'wait', ms: 1000 },
      { type: 'click_text', text: 'Go to Sign-In' },
      { type: 'wait', ms: 1500 },
    ],
    duration: 14000,
  },
  {
    module: 'sign_in_sign_out', slide: 4,
    path: ['Time Clock', 'Sign-In Config'],
    actions: [
      { type: 'wait', ms: 1000 },
      { type: 'click_text', text: 'Go to Sign-In' },
      { type: 'wait', ms: 1200 },
      { type: 'click_text', text: 'Pause' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Correction' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'OK' },
      { type: 'wait', ms: 1000 },
    ],
    duration: 14000,
  },
  {
    module: 'sign_in_sign_out', slide: 5,
    path: ['Time Clock', 'Sign-In/Sign-Out Config'],
    actions: [
      { type: 'wait', ms: 1200 },
      { type: 'click_text', text: 'Sign-Out' },
      { type: 'wait', ms: 2000 },
    ],
    duration: 12000,
  },
  {
    module: 'manual_process_hours', slide: 3,
    path: ['Payroll', 'Manage Process Hours'],
    actions: [{ type: 'wait', ms: 3000 }],
    duration: 12000,
  },
  {
    module: 'manual_process_hours', slide: 4,
    path: ['Payroll', 'Manage Process Hours'],
    actions: [
      { type: 'wait', ms: 1000 },
      { type: 'click_first_link', selector: 'td a' },
      { type: 'wait', ms: 1000 },
      { type: 'click_text', text: 'Sign-In' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Sign-Out' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Approve Hours' },
      { type: 'wait', ms: 1500 },
    ],
    duration: 14000,
  },
  {
    module: 'manual_process_hours', slide: 5,
    path: ['Payroll', 'Manage Process Hours'],
    actions: [
      { type: 'wait', ms: 1000 },
      { type: 'click_text', text: 'Autofill Sign-In' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Autofill Sign-Out' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Approve Hours' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Back' },
      { type: 'wait', ms: 800 },
    ],
    duration: 14000,
  },
  {
    module: 'billing', slide: 4,
    path: ['Billing', 'Check Bill for Job'],
    actions: [
      { type: 'wait', ms: 1000 },
      { type: 'click_text', text: 'View Unbilled' },
      { type: 'wait', ms: 2000 },
    ],
    duration: 12000,
  },
  {
    module: 'billing', slide: 5,
    path: ['Billing', 'Manage Billing Process'],
    actions: [
      { type: 'wait', ms: 1200 },
      { type: 'click_text', text: 'Search' },
      { type: 'wait', ms: 1200 },
      { type: 'click_text', text: 'Get Invoice Data' },
      { type: 'wait', ms: 1500 },
    ],
    duration: 14000,
  },
  {
    module: 'billing', slide: 6,
    path: ['Billing', 'Manage Billing Process'],
    actions: [
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Sign-In/Sign-Out' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Billing Tax' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Summary' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Billable Items' },
      { type: 'wait', ms: 800 },
      { type: 'click_text', text: 'Invoice Setup' },
      { type: 'wait', ms: 800 },
    ],
    duration: 14000,
  },
  {
    module: 'billing', slide: 7,
    path: ['Billing', 'Manage Billing Process'],
    actions: [
      { type: 'wait', ms: 1000 },
      { type: 'click_text', text: 'Generate Invoice' },
      { type: 'wait', ms: 1500 },
    ],
    duration: 12000,
  },
  {
    module: 'billing', slide: 8,
    path: ['Records', 'Manage Contract'],
    actions: [
      { type: 'wait', ms: 1000 },
      { type: 'click_text', text: 'Search' },
      { type: 'wait', ms: 1200 },
      { type: 'click_first_link', selector: 'td a' },
      { type: 'wait', ms: 1000 },
    ],
    duration: 14000,
  },
];

// CLI filters
const args = process.argv.slice(2);
const mIdx = args.indexOf('--module');
const sIdx = args.indexOf('--slide');
const moduleFilter = mIdx >= 0 ? args[mIdx + 1] : null;
const slideFilter  = sIdx >= 0 ? parseInt(args[sIdx + 1]) : null;

const targets = SLIDES.filter(s => {
  if (moduleFilter && s.module !== moduleFilter) return false;
  if (slideFilter  && s.slide  !== slideFilter)  return false;
  return true;
});

if (!targets.length) { console.error('No slides matched filters.'); process.exit(1); }

// ── Navigate top-level menu ──────────────────────────────────────────────────
async function navigate(page, menuPath) {
  for (const item of menuPath) {
    try {
      const el = page.locator(`text="${item}"`).first();
      await el.waitFor({ state: 'visible', timeout: 8000 });
      await el.click();
      await page.waitForTimeout(700);
    } catch (e) {
      console.warn(`  ⚠ Could not click menu "${item}": ${e.message.slice(0, 60)}`);
    }
  }
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
}

// ── Run one action ────────────────────────────────────────────────────────────
async function doAction(page, action) {
  switch (action.type) {
    case 'wait':
      await page.waitForTimeout(action.ms);
      break;
    case 'click_text':
      await page.locator(`text="${action.text}"`).first().click({ timeout: 5000 }).catch(() =>
        console.warn(`  ⚠ click_text "${action.text}" — not found`));
      break;
    case 'click_selector':
      await page.locator(action.selector).first().click({ timeout: 5000 }).catch(() =>
        console.warn(`  ⚠ click_selector "${action.selector}" — not found`));
      break;
    case 'click_first_link':
      await page.locator(action.selector).first().click({ timeout: 5000 }).catch(() =>
        console.warn(`  ⚠ click_first_link "${action.selector}" — not found`));
      break;
    case 'fill_selector':
      await page.locator(action.selector).first().fill(action.value, { timeout: 5000 }).catch(() =>
        console.warn(`  ⚠ fill_selector "${action.selector}" — not found`));
      break;
    case 'fill_visible':
      // Fill by finding the label and filling the next input
      await page.locator(`text="${action.label}"`).first()
        .locator('xpath=following::input[1]').fill(action.value, { timeout: 5000 }).catch(() =>
          console.warn(`  ⚠ fill_visible "${action.label}" — not found`));
      break;
  }
}

// ── Record one slide using persistent context ─────────────────────────────────
async function recordSlideCtx(ctx, slide) {
  const moduleDir = path.join(OUTPUT_DIR, slide.module);
  fs.mkdirSync(moduleDir, { recursive: true });

  const page = await ctx.newPage();

  try {
    await page.goto(WISH_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    if (await page.title() === 'WISH Login') {
      console.warn('  ⚠ Session expired — run save-session.js again');
      await page.close();
      return null;
    }

    await navigate(page, slide.path);

    for (const action of (slide.actions || [])) {
      await doAction(page, action);
    }

    await page.waitForTimeout(slide.duration || 8000);

  } catch (err) {
    console.error(`  ✗ ${err.message.slice(0, 80)}`);
  }

  const videoPath = await page.video()?.path();
  await page.close();

  if (videoPath && fs.existsSync(videoPath)) {
    const dest = path.join(moduleDir, `slide_${slide.slide}.webm`);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(videoPath, dest);
    console.log(`✓ ${dest}`);
    return dest;
  }
  console.warn(`  ⚠ No video for ${slide.module}/slide_${slide.slide}`);
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Recording ${targets.length} slide(s) from real WISH system → ${OUTPUT_DIR}\n`);

  // Use persistent profile so WISH session cookies are valid (same browser identity as login)
  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUTPUT_DIR, size: { width: 1280, height: 720 } },
  });

  for (const s of targets) {
    process.stdout.write(`[${s.module} / slide ${s.slide}]  `);
    await recordSlideCtx(browser, s);
  }

  await browser.close();
  console.log('\nDone.');
})();
