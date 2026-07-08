// Outbound email — uses Resend when RESEND_API_KEY is set (no token expiry), else falls back to Gmail.
const https = require('https');
const gmail = require('./gmail');

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
// Use a verified domain once set up; Resend's onboarding sender works out of the box for testing.
const RESEND_FROM = process.env.RESEND_FROM || 'WISH Training <onboarding@resend.dev>';

function sendViaResend(to, subject, html) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ from: RESEND_FROM, to: Array.isArray(to) ? to : [to], subject, html });
    const req = https.request(
      {
        hostname: 'api.resend.com', path: '/emails', method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(d || '{}'));
          else reject(new Error(`Resend ${res.statusCode}: ${d}`));
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendEmail(to, subject, html) {
  if (RESEND_API_KEY) {
    const r = await sendViaResend(to, subject, html);
    console.log(`[mailer] sent via Resend to ${Array.isArray(to) ? to.join(', ') : to}`);
    return r;
  }
  return gmail.sendEmail(to, subject, html); // fallback while Resend isn't configured
}

// Email is "configured" if either transport is available.
function isConfigured() {
  return !!RESEND_API_KEY || gmail.isConfigured();
}

module.exports = { sendEmail, isConfigured, usingResend: () => !!RESEND_API_KEY };
