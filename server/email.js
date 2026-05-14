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

async function sendInviteEmail(email, name, assignedModules, username, password) {
  if (!isConfigured()) {
    console.log(`[email] not configured — skipping invite to ${email}`);
    return;
  }
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const moduleList = Array.isArray(assignedModules) && assignedModules.length > 0
    ? `<div style="background:#F4F7FA;border-radius:8px;padding:16px 20px;margin:20px 0">
        <div style="font-size:11px;font-weight:700;color:#6B7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">Your assigned modules</div>
        ${assignedModules.map(id => `<div style="font-size:13px;color:#374151;padding:3px 0">&#10003; ${id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace('Sign In  Sign Out', 'Sign-In / Sign-Out')}</div>`).join('')}
      </div>`
    : '';
  await sendEmail(
    email,
    "You're enrolled in the WISH Training Program",
    brandedEmail(`
      <p style="font-size:16px;color:#111827;margin-top:0">${greeting}</p>
      <p style="color:#374151;line-height:1.6">You've been enrolled in the <strong>WISH Training Program</strong> by ProtaTECH. Your training has been customized based on your assigned system permissions.</p>
      ${moduleList}
      <div style="background:#F4F7FA;border-radius:8px;padding:16px 20px;margin:20px 0">
        <div style="font-size:11px;font-weight:700;color:#6B7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">Your Login Credentials</div>
        <div style="font-size:13px;color:#374151;padding:3px 0"><span style="font-weight:600;display:inline-block;width:90px">Username:</span> <span style="font-family:monospace;font-size:14px">${username || ''}</span></div>
        <div style="font-size:13px;color:#374151;padding:3px 0"><span style="font-weight:600;display:inline-block;width:90px">Password:</span> <span style="font-family:monospace;font-size:14px;letter-spacing:2px">${password || ''}</span></div>
        <div style="font-size:12px;color:#6B7280;margin-top:10px">Enter these exactly on the login screen at <a href="${SITE_URL}" style="color:#1B3A6B">${SITE_URL}</a></div>
      </div>
      <div style="text-align:center;margin:32px 0">
        <a href="${SITE_URL}" style="background:#D4782A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px">Start Training</a>
      </div>
      <p style="color:#6B7280;font-size:13px;line-height:1.6">Your progress is automatically saved — resume at any time from any browser.</p>
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
