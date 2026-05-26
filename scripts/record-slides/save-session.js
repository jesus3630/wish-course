#!/usr/bin/env node
// One-time login: opens WISH in a visible browser, waits for you to log in,
// then saves the session so record.js can reuse it without ever logging in again.
//
// Run once:  node save-session.js
// Then run:  node record.js

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const PROFILE_DIR = path.join(__dirname, 'browser-profile');
const WISH_URL = 'https://wish.schedulingsite.com';

fs.mkdirSync(PROFILE_DIR, { recursive: true });

(async () => {
  console.log('Opening WISH login page...');
  console.log('Log in with your credentials — the window will close automatically.\n');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    args: ['--window-size=1280,800', '--disable-infobars'],
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(WISH_URL);

  // Auto-detect successful login — wait up to 2 minutes
  console.log('Waiting for you to log in (2 min)...');
  await page.waitForFunction(
    () => document.title !== 'WISH Login' && !window.location.search.includes('ReturnUrl'),
    null,
    { timeout: 120000, polling: 1500 }
  );

  console.log('Login detected. Session saved to browser-profile/');
  console.log('You can now run:  node record.js');

  await context.close();
  process.exit(0);
})();
