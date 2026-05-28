#!/usr/bin/env node
/**
 * Fix mojibake (UTF-8 text misread as Windows-1252) in PostgreSQL course/quiz data.
 * Handles 1x, 2x, and 3x encoded text.
 */
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Maps Windows-1252 Unicode code points back to their byte values (0x80-0x9F range)
const win1252ToByte = {
  0x20AC: 0x80, // €
  0x201A: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201E: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02C6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8A, // Š
  0x2039: 0x8B, // ‹
  0x0152: 0x8C, // Œ
  0x017D: 0x8E, // Ž
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201C: 0x93, // "
  0x201D: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02DC: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9A, // š
  0x203A: 0x9B, // ›
  0x0153: 0x9C, // œ
  0x017E: 0x9E, // ž
  0x0178: 0x9F, // Ÿ
};

/**
 * Attempt one round of mojibake reversal.
 * Returns fixed string, or null if the string contains non-Win1252 chars.
 */
function tryFixOnce(str) {
  try {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code in win1252ToByte) {
        bytes.push(win1252ToByte[code]);
      } else if (code < 256) {
        bytes.push(code);
      } else {
        // Contains a character that isn't representable in Windows-1252 — bail
        return null;
      }
    }
    // Verify result is valid UTF-8 by round-tripping through Buffer
    const result = Buffer.from(bytes).toString('utf8');
    // Sanity: don't return replacement chars (indicates bad UTF-8)
    if (result.includes('�')) return null;
    return result;
  } catch (e) {
    return null;
  }
}

/**
 * Apply mojibake fix up to 3 times (handles 1x/2x/3x encoding).
 */
function fixString(str) {
  if (!str || typeof str !== 'string') return str;
  let current = str;
  for (let i = 0; i < 3; i++) {
    const fixed = tryFixOnce(current);
    if (!fixed || fixed === current) break;
    current = fixed;
  }
  return current;
}

/**
 * Recursively fix all string values in a JSON object.
 */
function fixDeep(obj) {
  if (typeof obj === 'string') return fixString(obj);
  if (Array.isArray(obj)) return obj.map(fixDeep);
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const key of Object.keys(obj)) {
      result[key] = fixDeep(obj[key]);
    }
    return result;
  }
  return obj;
}

async function fixTable(tableName) {
  const { rows } = await pool.query(`SELECT id, data FROM ${tableName}`);
  let fixed = 0;
  for (const row of rows) {
    const before = JSON.stringify(row.data);
    const after = fixDeep(row.data);
    const afterStr = JSON.stringify(after);
    if (before !== afterStr) {
      await pool.query(`UPDATE ${tableName} SET data = $1 WHERE id = $2`, [afterStr, row.id]);
      console.log(`  Fixed: ${row.id}`);
      fixed++;
    }
  }
  console.log(`  ${tableName}: ${fixed}/${rows.length} rows updated`);
  return fixed;
}

async function fixJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const fixed = fixDeep(data);
  const fixedStr = JSON.stringify(fixed, null, 2);
  if (raw.trim() !== fixedStr.trim()) {
    fs.writeFileSync(filePath, fixedStr + '\n', 'utf8');
    console.log(`  Fixed: ${path.basename(filePath)}`);
    return true;
  }
  console.log(`  No changes: ${path.basename(filePath)}`);
  return false;
}

async function run() {
  console.log('=== Fixing encoding in PostgreSQL ===');
  await fixTable('course_data');
  await fixTable('quiz_data');

  console.log('\n=== Fixing encoding in JSON seed files ===');
  const root = path.join(__dirname, '..');
  await fixJsonFile(path.join(root, 'course_data.json'));
  await fixJsonFile(path.join(root, 'quiz_data.json'));

  await pool.end();
  console.log('\nDone.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
