const { google } = require('googleapis');
const mammoth = require('mammoth');

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
    // Skip self-sent to prevent reply loops
    if (agentEmail && parsed.fromEmail.toLowerCase() === agentEmail) continue;

    // Extract text from any .docx attachments (WISH permission forms)
    if (parsed.docxAttachments.length > 0) {
      let formText = '';
      for (const att of parsed.docxAttachments) {
        try {
          const attRes = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: msg.id,
            id: att.attachmentId,
          });
          const buf = Buffer.from(attRes.data.data, 'base64');
          const result = await mammoth.extractRawText({ buffer: buf });
          formText += result.value;
        } catch (e) {
          console.error(`[gmail] Failed to extract attachment ${att.filename}:`, e.message);
        }
      }
      if (formText) parsed.attachmentText = formText;
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
