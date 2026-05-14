/**
 * One-time Gmail OAuth2 setup — run locally to get your refresh token.
 *
 * Steps:
 *  1. Go to console.cloud.google.com
 *  2. Create/select a project → APIs & Services → Enable Gmail API
 *  3. APIs & Services → Credentials → Create OAuth 2.0 Client ID
 *     - Application type: Web application
 *     - Authorized redirect URI: http://localhost:3456/oauth/callback
 *  4. Copy the Client ID and Client Secret into server/.env:
 *       GMAIL_CLIENT_ID=...
 *       GMAIL_CLIENT_SECRET=...
 *       GMAIL_AGENT_EMAIL=gahnr434@gmail.com
 *  5. Run: node scripts/gmail-auth.js
 *  6. Open the printed URL in your browser and authorize
 *  7. Copy the GMAIL_REFRESH_TOKEN printed to the terminal
 *  8. Add it to server/.env and Railway env vars
 */

require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3456/oauth/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in server/.env first.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.modify'],
  prompt: 'consent',
  login_hint: process.env.GMAIL_AGENT_EMAIL,
});

console.log('\nOpen this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for authorization...\n');

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname !== '/oauth/callback') return;

  const code = parsed.query.code;
  if (!code) {
    res.end('No code received.');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.end('<h2>Authorization complete! Check your terminal.</h2><p>You can close this tab.</p>');
    server.close();

    console.log('\n--- Copy these into server/.env and Railway Variables ---\n');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n---------------------------------------------------------\n');
  } catch (e) {
    res.end('Error: ' + e.message);
    console.error(e);
    server.close();
  }
});

server.listen(3456, () => {
  console.log('Listening on http://localhost:3456 ...\n');
});
