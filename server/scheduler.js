// Native WISH scheduler — nudges non-starters to begin their assigned training.
// (Completion notifications are already event-driven in POST /api/progress, so they're not here.)
// Idempotent: roster.last_reminded_at ensures each person is reminded at most once.

const { isConfigured } = require('./gmail');
const { sendReminderEmail } = require('./email');

const REMINDER_DAYS = parseInt(process.env.REMINDER_DAYS || '7', 10); // remind after N days with no login
const RUN_EVERY_MS = 6 * 60 * 60 * 1000;                              // check every 6h (safe to repeat)

async function runReminders(pool) {
  // Don't touch anyone if email isn't set up — otherwise we'd mark them reminded without sending.
  if (!isConfigured()) return;
  try {
    const r = await pool.query(
      `SELECT r.email, r.name, r.username
       FROM roster r
       LEFT JOIN user_progress up ON up.email = r.email
       WHERE up.email IS NULL                                   -- never logged in / no progress
         AND r.added_at <= NOW() - make_interval(days => $1)    -- enrolled at least N days ago
         AND r.last_reminded_at IS NULL                         -- not yet reminded
       LIMIT 200`,
      [REMINDER_DAYS]
    );
    if (!r.rows.length) return;
    console.log(`[scheduler] sending ${r.rows.length} training reminder(s)`);
    for (const row of r.rows) {
      try {
        await sendReminderEmail(row.email, row.name, row.username);
        // Only mark once the send actually succeeded — a throw (e.g. expired token) leaves it to retry.
        await pool.query('UPDATE roster SET last_reminded_at = NOW() WHERE email = $1', [row.email]);
      } catch (e) {
        console.error(`[scheduler] reminder failed for ${row.email}:`, e.message);
      }
    }
  } catch (e) {
    console.error('[scheduler] runReminders error:', e.message);
  }
}

function start(pool) {
  setTimeout(() => runReminders(pool), 60 * 1000);   // shortly after boot
  setInterval(() => runReminders(pool), RUN_EVERY_MS); // then periodically
  console.log(`[scheduler] started — remind non-starters after ${REMINDER_DAYS} days, checking every 6h`);
}

module.exports = { start, runReminders };
