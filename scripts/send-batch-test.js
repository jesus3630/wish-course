// Sends one email with 2 WISH permission forms attached (test emails substituted)
require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });
const { google } = require('googleapis');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

const TEST_EMAILS = ['jesusg.biz11@gmail.com', 'jesusg.biz11+employee2@gmail.com'];

const FORMS = [
  path.join(process.env.HOME, 'Downloads/WISH User Permissons Form - Kirsten De La O 5.04.26.docx'),
  path.join(process.env.HOME, 'Downloads/WISH User Permissons Form - Gloria Lopez 5.04.26.docx'),
];

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost:3456/oauth/callback'
  );
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return client;
}

async function patchDocxEmail(filePath, testEmail) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  let xml = await zip.file('word/document.xml').async('string');

  // The "Employee Email" paragraph may have the email split across multiple <w:t> runs.
  // Strategy: find the paragraph containing the label, replace the first non-trivial <w:t>
  // content with the test email and blank out the rest in that paragraph.
  xml = xml.replace(
    /(Employee Email[^<]*<\/w:t>)([\s\S]*?)(<\/w:p>)/,
    (match, labelPart, rest, closing) => {
      let placed = false;
      const patched = rest.replace(/(<w:t[^>]*>)([^<]*)(<\/w:t>)/g, (m, open, text, close) => {
        if (!text.trim() || /^[\s:]+$/.test(text)) return m; // skip empty/colon runs
        if (!placed) { placed = true; return `${open}${testEmail}${close}`; }
        return `${open}${close}`; // clear remaining runs that were part of the original email
      });
      return `${labelPart}${patched}${closing}`;
    }
  );

  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function toBase64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function buildMimeMessage(from, to, subject, attachments) {
  const boundary = 'wish_batch_test_' + Date.now();
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Please find attached 2 WISH permission forms for enrollment.',
    '',
  ];

  for (const att of attachments) {
    lines.push(`--${boundary}`);
    lines.push('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    // chunk base64 at 76 chars per line (RFC 2045)
    const b64 = att.data.toString('base64');
    for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
    lines.push('');
  }

  lines.push(`--${boundary}--`);
  return Buffer.from(lines.join('\r\n'));
}

async function main() {
  const gmail = google.gmail({ version: 'v1', auth: getOAuth2Client() });
  const agentEmail = process.env.GMAIL_AGENT_EMAIL || 'gahnr434@gmail.com';

  console.log('Patching forms with test emails...');
  const attachments = [];
  for (let i = 0; i < FORMS.length; i++) {
    const testEmail = TEST_EMAILS[i];
    const buf = await patchDocxEmail(FORMS[i], testEmail);
    const filename = `WISH_Test_Form_${i + 1}.docx`;
    console.log(`  Form ${i + 1}: ${path.basename(FORMS[i])} → ${testEmail}`);
    attachments.push({ filename, data: buf });
  }

  const rawBuf = await buildMimeMessage(
    agentEmail,
    agentEmail,
    'WISH Enrollment - Batch Test (2 Forms)',
    attachments
  );

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: toBase64url(rawBuf) },
  });

  console.log(`\nSent to ${agentEmail} with ${attachments.length} forms attached.`);
  console.log('Agent will pick it up within 60s.');
}

main().catch((e) => { console.error(e); process.exit(1); });
