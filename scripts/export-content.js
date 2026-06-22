#!/usr/bin/env node
/**
 * Snapshot live content back into the repo seed files.
 *
 * The course scripts, quiz questions, and interactive-demo prompt overrides live
 * in the database (edited via /admin). This pulls the *current* live content and
 * writes it into course_data.json + quiz_data.json, so the repo always holds the
 * exact content "as you see it now" — never trapped only in a database.
 *
 * Usage:
 *   node scripts/export-content.js                       # snapshot the default app URL
 *   node scripts/export-content.js https://your-app-url  # snapshot a specific deployment
 *   APP_URL=https://your-app-url node scripts/export-content.js
 *
 * Run this whenever you've made content edits in /admin and want the repo to match.
 * Commit the changed JSON files afterward. A fresh database will then seed to this exact state.
 */
const fs = require('fs');
const path = require('path');

const BASE = (process.argv[2] || process.env.APP_URL || 'https://www.wishtrainingtest.com').replace(/\/+$/, '');
const COURSE_PATH = path.join(__dirname, '..', 'course_data.json');
const QUIZ_PATH = path.join(__dirname, '..', 'quiz_data.json');

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function countSlides(course) {
  const mods = Array.isArray(course) ? course : (course.modules || []);
  return mods.reduce((n, m) => n + ((m && m.slides) ? m.slides.length : 0), 0);
}

(async () => {
  console.log(`Snapshotting content from ${BASE} ...`);
  const [course, quiz] = await Promise.all([
    getJSON(`${BASE}/api/course?nc=${Date.now()}`),
    getJSON(`${BASE}/api/quiz`),
  ]);

  const mods = Array.isArray(course) ? course : (course.modules || []);
  const questions = Object.values(quiz).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);

  fs.writeFileSync(COURSE_PATH, JSON.stringify(mods, null, 2));
  fs.writeFileSync(QUIZ_PATH, JSON.stringify(quiz, null, 2));

  console.log(`  ✓ course_data.json  — ${mods.length} modules, ${countSlides(mods)} slides`);
  console.log(`  ✓ quiz_data.json    — ${Object.keys(quiz).length} modules, ${questions} questions`);
  console.log(`\nDone. Review the diff and commit:`);
  console.log(`  git diff --stat course_data.json quiz_data.json`);
  console.log(`  git add course_data.json quiz_data.json && git commit -m "Snapshot content from ${BASE}"`);
  console.log(`\nA fresh database will seed to this exact content on first boot.`);
})().catch(e => { console.error('Export failed:', e.message); process.exit(1); });
