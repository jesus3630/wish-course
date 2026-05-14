const Anthropic = require('@anthropic-ai/sdk');
const { isConfigured, getUnreadEmails, sendEmail, markAsRead } = require('./gmail');
const { sendInviteEmail } = require('./email');

const SITE_URL = process.env.SITE_URL || 'https://wish-training.up.railway.app';
const AGENT_EMAIL = (process.env.GMAIL_AGENT_EMAIL || '').toLowerCase();
const POLL_INTERVAL_MS = 60 * 1000;

let pool;
let anthropic;

// Permission name → module ID (matches the WISH permission form checkboxes)
const PERMISSION_TO_MODULE = {
  'record maintenance': 'record_maintenance',
  'manage job': 'manage_job',
  'mss': 'mss',
  'scheduling': 'scheduling',
  'schedule by job admin': 'schedule_by_job_admin',
  'payroll processing': 'payroll_processing',
  'general reporting': 'general_reporting',
  'payroll reporting': 'payroll_reporting',
  'admin reporting': 'admin_reporting',
  'workforce scheduler maintenance': 'workforce_scheduler_mntnnce',
  'workforce admin maintenance': 'workforce_admin_maintenance',
  'employee hr record maintenance': 'employee_hr_record_maintenance',
  'hiring manager': 'hiring_manager',
  'hr admin': 'hiring_admin',
  'hiring admin': 'hiring_admin',
  'mail by': 'mail_by',
  'sign-in/sign-out': 'sign-in__sign-out',
  'sign-in': 'sign-in__sign-out',
  'sign in sign out': 'sign-in__sign-out',
  'manual process hours': 'manual_process_hours',
  'billing': 'billing',
  'inventory': 'inventory',
};

function mapPermissions(permissions) {
  const moduleIds = ['introduction']; // everyone gets intro
  for (const perm of (permissions || [])) {
    const key = perm.toLowerCase().trim();
    const moduleId = PERMISSION_TO_MODULE[key];
    if (moduleId && !moduleIds.includes(moduleId)) moduleIds.push(moduleId);
  }
  return moduleIds;
}

const TOOLS = [
  {
    name: 'enroll_user',
    description: 'Add a person to the WISH training roster with their specific permissions and send them an enrollment invite.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name of the person to enroll' },
        email: { type: 'string', description: 'Email address of the person to enroll' },
        permissions: {
          type: 'array',
          items: { type: 'string' },
          description: 'WISH permissions being granted. Use exact names from the form: Record Maintenance, Manage Job, MSS, Scheduling, Schedule by Job Admin, General Reporting, Payroll Reporting, Admin Reporting, Workforce Scheduler Maintenance, Workforce Admin Maintenance, Employee HR Record Maintenance, Hiring Manager, HR Admin, Mail By, Sign-In/Sign-Out, Manual Process Hours, Billing, Inventory',
        },
      },
      required: ['email', 'permissions'],
    },
  },
  {
    name: 'check_progress',
    description: 'Look up the WISH training progress for a specific user by email.',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address to look up' },
      },
      required: ['email'],
    },
  },
  {
    name: 'list_enrolled_users',
    description: 'Get all users currently enrolled in WISH training with their progress and completion status.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'remove_user',
    description: 'Remove a user from the WISH training roster.',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address to remove' },
      },
      required: ['email'],
    },
  },
  {
    name: 'send_reply',
    description: 'Send a reply email back to the person who made the request. Always call this at the end to confirm what was done.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The reply message. Be concise and professional.' },
      },
      required: ['message'],
    },
  },
];

const SYSTEM_PROMPT = `You are an automated WISH Training administrator agent for ProtaTECH. You receive emails and autonomously manage training enrollments for Los Angeles County staff on the WISH (Workforce Information Systems Hosted) platform.

For every email you process:
1. Determine the intent from the email subject and body
2. Take the appropriate action using the available tools
3. Always end by calling send_reply to confirm what you did

ENROLLING A USER:
- Extract the employee's name, email, and which WISH permissions they are being granted
- Permissions come from the WISH User Permissions Request Form and include: Record Maintenance, Manage Job, MSS, Scheduling, Schedule by Job Admin, General Reporting, Payroll Reporting, Admin Reporting, Workforce Scheduler Maintenance, Workforce Admin Maintenance, Employee HR Record Maintenance, Hiring Manager, HR Admin, Mail By, Sign-In/Sign-Out, Manual Process Hours, Billing, Inventory
- Only assign the modules matching the permissions they were granted — do NOT assign all modules
- Every user always gets the Introduction module in addition to their specific permissions

Other supported requests:
- Check progress: "What's the status for john@lacounty.gov?"
- List everyone: "Who is enrolled?" / "Send me a status report"
- Remove someone: "Remove bob@example.com from training"

If the request is unclear, send a polite reply listing what you can help with.
If the email appears to be spam or unrelated to WISH training, reply briefly and ignore.
Never invent information — only report what the tools return.`;

async function executeTool(name, input, emailCtx) {
  switch (name) {
    case 'enroll_user': {
      const { name: userName, email, permissions } = input;
      const normalizedEmail = email.toLowerCase().trim();
      const assignedModules = mapPermissions(permissions);
      await pool.query(
        'INSERT INTO roster (email, name, assigned_modules) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET name = COALESCE($2, roster.name), assigned_modules = $3',
        [normalizedEmail, userName?.trim() || null, JSON.stringify(assignedModules)]
      );
      await sendInviteEmail(normalizedEmail, userName, assignedModules);
      return { success: true, enrolled: normalizedEmail, assigned_modules: assignedModules };
    }

    case 'check_progress': {
      const { email } = input;
      const r = await pool.query(
        'SELECT data, last_synced FROM user_progress WHERE email = $1',
        [email.toLowerCase().trim()]
      );
      if (r.rowCount === 0) return { found: false, email };
      const d = r.rows[0].data;
      const mods = d.modules || {};
      return {
        found: true,
        name: d.user_name,
        email,
        modules_completed: Object.values(mods).filter((m) => m.completed).length,
        modules_started: Object.keys(mods).length,
        fully_completed: !!d.completed_at,
        completed_at: d.completed_at || null,
        last_active: r.rows[0].last_synced,
      };
    }

    case 'list_enrolled_users': {
      const r = await pool.query(
        'SELECT email, data, last_synced FROM user_progress ORDER BY last_synced DESC'
      );
      return {
        total: r.rowCount,
        users: r.rows.map((row) => ({
          email: row.email,
          name: row.data.user_name,
          modules_completed: Object.values(row.data.modules || {}).filter((m) => m.completed).length,
          fully_completed: !!row.data.completed_at,
          last_active: row.last_synced,
        })),
      };
    }

    case 'remove_user': {
      const { email } = input;
      await pool.query('DELETE FROM roster WHERE email = $1', [email.toLowerCase().trim()]);
      return { success: true, removed: email };
    }

    case 'send_reply': {
      const { message } = input;
      const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px">
        <div style="background:#1B3A6B;padding:16px 20px;border-radius:8px 8px 0 0">
          <span style="color:#D4782A;font-size:22px;font-weight:900;letter-spacing:3px">WISH</span>
          <span style="color:#fff;font-size:11px;margin-left:8px;opacity:0.8">Training Agent</span>
        </div>
        <div style="border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;padding:28px 24px">
          <p style="color:#374151;line-height:1.8;white-space:pre-line;margin:0 0 24px">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 16px">
          <p style="color:#9CA3AF;font-size:12px;margin:0">ProtaTECH WISH Training Portal &middot; <a href="${SITE_URL}" style="color:#1B3A6B">${SITE_URL}</a></p>
        </div>
      </div>`;
      await sendEmail(emailCtx.fromEmail, `Re: ${emailCtx.subject}`, html, emailCtx.threadId);
      return { success: true };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function processEmail(email) {
  console.log(`[agent] Processing: "${email.subject}" from ${email.fromEmail}`);

  const messages = [
    {
      role: 'user',
      content: `From: ${email.from}\nSubject: ${email.subject}\n\n${email.body.substring(0, 4000)}`,
    },
  ];

  // Agentic loop — keeps running until Claude stops requesting tools
  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === 'end_turn') break;
    if (response.stop_reason !== 'tool_use') break;

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      console.log(`[agent] Tool: ${block.name}`, JSON.stringify(block.input));
      const result = await executeTool(block.name, block.input, email);
      console.log(`[agent] Result:`, JSON.stringify(result));
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });
  }

  console.log(`[agent] Done: ${email.fromEmail}`);
}

async function poll() {
  if (!isConfigured()) {
    console.log('[agent] Gmail API not configured — skipping poll');
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[agent] ANTHROPIC_API_KEY not set — skipping poll');
    return;
  }

  try {
    const emails = await getUnreadEmails();
    if (emails.length > 0) console.log(`[agent] ${emails.length} new email(s) to process`);
    for (const email of emails) {
      try {
        await processEmail(email);
      } catch (e) {
        console.error(`[agent] Failed processing ${email.messageId}:`, e.message);
      } finally {
        await markAsRead(email.messageId).catch(() => {});
      }
    }
  } catch (e) {
    console.error('[agent] Poll error:', e.message);
  }
}

function start(dbPool) {
  pool = dbPool;
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  console.log('[agent] Email agent starting — polling every 60s');
  poll(); // run immediately
  setInterval(poll, POLL_INTERVAL_MS);
}

module.exports = { start };
