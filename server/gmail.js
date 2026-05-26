const { google } = require('googleapis');
const JSZip = require('jszip');

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost:3456/oauth/callback'
  );
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return client;
}

function getClient() {
  return google.gmail({ version: 'v1', auth: getOAuth2Client() });
}

function isConfigured() {
  return !!(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  );
}

function parseMessage(msgData) {
  const headers = msgData.payload.headers;
  const h = (name) => headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value || '';

  const from = h('From');
  const emailMatch = from.match(/<(.+?)>/);
  const fromEmail = emailMatch ? emailMatch[1].trim() : from.trim();
  const fromName = from.replace(/<.+?>/, '').trim().replace(/^"|"$/g, '');

  // Extract plain-text body and .docx attachment IDs from MIME tree
  let body = '';
  const docxAttachments = [];
  function walk(part) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body += Buffer.from(part.body.data, 'base64').toString('utf8');
    } else if (
      part.body?.attachmentId &&
      (part.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        (part.filename || '').toLowerCase().endsWith('.docx'))
    ) {
      docxAttachments.push({ attachmentId: part.body.attachmentId, filename: part.filename });
    } else if (part.parts) {
      part.parts.forEach(walk);
    }
  }
  walk(msgData.payload);

  return {
    messageId: msgData.id,
    threadId: msgData.threadId,
    from,
    fromEmail,
    fromName,
    subject: h('Subject'),
    body,
    docxAttachments,
  };
}

async function parseWishForm(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');

  // Extract employee fields — collect all text runs in the paragraph after the label
  function fieldAfterLabel(label) {
    const re = new RegExp(label + '[^<]*<\\/w:t>([\\s\\S]*?)<\\/w:p>');
    const section = xml.match(re)?.[1] || '';
    const texts = [...section.matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g)].map((m) => m[1]).join('');
    return texts.replace(/^[\s:]+/, '').trim();
  }
  const employeeName = fieldAfterLabel('Employee Name');
  const employeeEmail = fieldAfterLabel('Employee Email').split(/\s/)[0]; // stop at whitespace (before Employee Phone)
  const requesterName = fieldAfterLabel('Requester Name');

  // Extract checked permissions from w14:checkbox SDT blocks
  const checkedPermissions = [];
  const sdtRegex = /<w:sdt>([\s\S]*?)<\/w:sdt>/g;
  let m;
  while ((m = sdtRegex.exec(xml)) !== null) {
    const block = m[1];
    const checkedMatch = block.match(/<w14:checked w14:val="(\d+)"/);
    if (!checkedMatch || checkedMatch[1] !== '1') continue;
    // Get permission name from text immediately after this sdt
    const after = xml.substring(m.index + m[0].length, m.index + m[0].length + 600);
    const text = [...after.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)]
      .map((x) => x[1])
      .join('')
      .trim()
      .replace(/\(.*$/, '') // strip description in parens
      .trim();
    if (text) checkedPermissions.push(text);
  }

  if (!checkedPermissions.length) return null;

  const lines = ['WISH PERMISSION FORM (PARSED FROM ATTACHMENT)'];
  if (employeeName) lines.push(`Employee Name: ${employeeName}`);
  if (employeeEmail) lines.push(`Employee Email: ${employeeEmail}`);
  if (requesterName) lines.push(`Requested By: ${requesterName}`);
  lines.push('', 'CHECKED PERMISSIONS:');
  checkedPermissions.forEach((p) => lines.push(`- ${p}`));

  console.log(`[gmail] Parsed .docx: ${checkedPermissions.length} permissions checked for ${employeeName || 'unknown'}`);
  return lines.join('\n');
}

async function getUnreadEmails() {
  const gmail = getClient();
  const agentEmail = (process.env.GMAIL_AGENT_EMAIL || '').toLowerCase();

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox',
    maxResults: 10,
  });

  const messages = res.data.messages || [];
  const emails = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
    const parsed = parseMessage(detail.data);
    // Skip self-sent only when no attachment — replies never have forms, form emails may be self-sent in tests
    if (agentEmail && parsed.fromEmail.toLowerCase() === agentEmail && parsed.docxAttachments.length === 0) continue;

    // Parse any .docx attachments as WISH permission forms (supports multiple)
    parsed.attachmentTexts = [];
    if (parsed.docxAttachments.length > 0) {
      for (const att of parsed.docxAttachments) {
        try {
          const attRes = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: msg.id,
            id: att.attachmentId,
          });
          const buf = Buffer.from(attRes.data.data, 'base64');
          const formText = await parseWishForm(buf);
          if (formText) parsed.attachmentTexts.push(formText);
        } catch (e) {
          console.error(`[gmail] Failed to parse attachment ${att.filename}:`, e.message);
        }
      }
    }

    emails.push(parsed);
  }

  return emails;
}

async function sendEmail(to, subject, htmlBody, threadId) {
  const gmail = getClient();
  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ].join('\r\n');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: Buffer.from(raw).toString('base64url'),
      ...(threadId ? { threadId } : {}),
    },
  });
}

async function markAsRead(messageId) {
  const gmail = getClient();
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  });
}

module.exports = { isConfigured, getUnreadEmails, sendEmail, markAsRead, SCOPES, getOAuth2Client };
