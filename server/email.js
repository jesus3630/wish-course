const { sendEmail, isConfigured } = require('./gmail');

const SITE_URL = process.env.SITE_URL || 'https://wish-training.up.railway.app';

function brandedEmail(content) {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px">
    <div style="background:#1B3A6B;padding:20px 24px;border-radius:8px 8px 0 0;text-align:center">
      <span style="color:#D4782A;font-size:28px;font-weight:900;letter-spacing:4px">WISH</span>
      <div style="color:#fff;font-size:11px;margin-top:4px;letter-spacing:2px">WORKFORCE INFORMATION SYSTEMS HOSTED</div>
    </div>
    <div style="border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;padding:32px 24px">
      ${content}
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0">
      <p style="color:#9CA3AF;font-size:12px;margin:0;text-align:center">ProtaTECH Training Portal &middot; <a href="${SITE_URL}" style="color:#1B3A6B">${SITE_URL}</a></p>
    </div>
  </div>`;
}

async function sendInviteEmail(email, name) {
  if (!isConfigured()) {
    console.log(`[email] not configured — skipping invite to ${email}`);
    return;
  }
  const greeting = name ? `Hi ${name},` : 'Hello,';
  await sendEmail(
    email,
    "You're enrolled in the WISH Training Program",
    brandedEmail(`
      <p style="font-size:16px;color:#111827;margin-top:0">${greeting}</p>
      <p style="color:#374151;line-height:1.6">You've been enrolled in the <strong>WISH Training Program</strong> by ProtaTECH. This self-paced online course covers all aspects of the Workforce Information Systems Hosted platform used by Los Angeles County.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${SITE_URL}" style="background:#D4782A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px">Start Training</a>
      </div>
      <p style="color:#6B7280;font-size:13px;line-height:1.6">Complete all modules and their knowledge checks to earn your certificate of completion. Your progress is automatically saved — resume at any time from any browser.</p>
    `)
  );
  console.log(`[email] Invite sent to ${email}`);
}

async function sendCompletionEmail(name, email) {
  if (!isConfigured()) {
    console.log(`[email] not configured — skipping completion email to ${email}`);
    return;
  }
  const completedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  await sendEmail(
    email,
    `Congratulations ${name} — WISH Training Complete!`,
    brandedEmail(`
      <div style="text-align:center;margin-bottom:24px">
        <div style="width:72px;height:72px;background:#1B3A6B;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
          <span style="color:#D4782A;font-size:32px">&#10003;</span>
        </div>
        <h1 style="color:#1B3A6B;font-size:22px;margin:0 0 8px">Certificate of Completion</h1>
        <p style="color:#374151;font-size:16px;margin:0">Congratulations, <strong>${name}</strong>!</p>
      </div>
      <p style="color:#374151;line-height:1.6;text-align:center">You have successfully completed all modules of the <strong>WISH Training Program</strong> on <strong>${completedDate}</strong>.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${SITE_URL}" style="background:#1B3A6B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px">View &amp; Print Certificate</a>
      </div>
    `)
  );
  console.log(`[email] Completion email sent to ${email}`);
}

module.exports = { sendInviteEmail, sendCompletionEmail };
