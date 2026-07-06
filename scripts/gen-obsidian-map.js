#!/usr/bin/env node
// Generates an interlinked Obsidian note graph of the WISH Training architecture.
// Nodes = systems/features/modules; edges = [[wikilinks]]. Open Obsidian → Graph view.
// Re-run anytime to refresh (module list is read live from course_data.json).

const fs = require('fs');
const path = require('path');

const VAULT = '/Users/maincall/Documents/Documents - Jesus’s Mac mini/Original /Originall/WISH Map';
const course = JSON.parse(fs.readFileSync(path.join(__dirname, '../course_data.json'), 'utf8'));
const modules = Array.isArray(course) ? course : (course.modules || []);

// Filesystem- AND wikilink-safe title (no / : * ? " < > | so filename == link target)
const safe = t => t.replace(/[\\/:*?"<>|]/g, '-');

// Project status per node → drives graph color groups. Default 'done'.
const STATUS = {
  'Gmail Agent': 'blocked',                              // refresh token expired — email path blocked
  'California Meal & Rest Breaks (AB 1512)': 'draft',    // legal slides pending compliance sign-off
  'California Breaks Demo': 'draft',
};

// ── Hand-authored nodes: [title, tag, description, [links]] ───────────────────
const nodes = [
  ['WISH Training', 'hub',
    'ProtaTECH’s WISH (Workforce Information Systems Hosted) training platform for staff. Employees complete assigned modules, take quizzes, ask the AI tutor, and earn a certificate. Live at www.wishtrainingtest.com.',
    ['Modules', 'Interactive Demo Engine', 'Voice Q&A Tutor', 'Tutor Analytics', 'Enrollment & Email Agent',
     'ESS Integration', 'Admin Panel', 'Narration', 'Quiz', 'Certificate', 'User Progress', 'Database',
     'Deploy & Railway', 'Tech Stack', 'Mobile', 'Gotchas']],

  // ── Learning experience ──
  ['Interactive Demo Engine', 'feature',
    'Click-through simulations of real WISH screens (`client/public/mockup/mockup.html`). Guided steps highlight and drive a fake-but-faithful WISH UI. See SYSTEM.md.',
    ['WISH Training', 'runGuided', 'SimFrame', 'Mockup Screens', 'Fullscreen Demo Mode', 'Modules', 'Gotchas']],
  ['runGuided', 'feature',
    'The guided-step engine: `runGuided(steps)` with `{selector, prompt, onConfirm, skipClick}`. Highlights a target, waits for a click (or a "Next"), then advances. Completion overlay at the end.',
    ['Interactive Demo Engine', 'Mockup Screens']],
  ['SimFrame', 'feature',
    'React wrapper that renders the 1280×720 mockup in an iframe, scaled to fit via CSS `zoom`. Adds swipe hint + Full screen button on phones.',
    ['Interactive Demo Engine', 'Mobile', 'Fullscreen Demo Mode', 'Gotchas']],
  ['Fullscreen Demo Mode', 'feature',
    'Phone-friendly: "Rotate to landscape / ⛶ Full screen". Overlay is portaled to <body> so it escapes transformed ancestors and covers the full viewport. Portrait fits the whole demo; landscape ~80% bigger.',
    ['SimFrame', 'Mobile', 'Gotchas']],
  ['Mockup Screens', 'feature',
    'Per-screen HTML helpers that recreate real WISH pages (Manage Process Hours, shift rosters, job forms, Exception Filter, reports…). Randomized names — no real staff data.',
    ['Interactive Demo Engine', 'Manage Process Hours', 'Sign-Out Exceptions', 'California Breaks Demo']],
  ['Manage Process Hours', 'screen',
    'Payroll screen recreated for demos: shift roster with sign-in/out, rates, per diem. California variant adds Breaks count + W/MP/BP columns.',
    ['Mockup Screens', 'California Breaks Demo']],
  ['Sign-Out Exceptions', 'screen',
    'Exception Filter (Signin/Out OverLap vs Negative Hours) → Retrieve → overlap results. Teaches the cross-midnight overlap (sign-out lands the next day → ~27hr shift) → ADJ/Submit.',
    ['Mockup Screens']],
  ['California Breaks Demo', 'screen',
    'CA Manage Process Hours with break tracking (Breaks 1–8, Waiver/Meal-Premium/Break-Premium). Centerpiece of the California module.',
    ['Mockup Screens', 'Manage Process Hours', 'ESS Integration']],

  ['Narration', 'feature',
    'Pre-generated ElevenLabs MP3s (Darryl voice), named by sha256(text), served statically at zero API cost. Word-highlighting synced to per-file timings.',
    ['WISH Training', 'ElevenLabs', 'Pregen Audio', 'Word Highlighting']],
  ['ElevenLabs', 'ext', 'Text-to-speech provider (Darryl voice). Creator tier. Also used to speak tutor answers.', ['Narration', 'Voice Q&A Tutor']],
  ['Pregen Audio', 'feature', '`scripts/pregen-audio.js` — batch-generates narration. Strips bullets and normalizes "Job" for correct TTS.', ['Narration', 'Gotchas']],
  ['Word Highlighting', 'feature', 'RAF loop + binary search over timing JSON highlights each spoken word as narration plays.', ['Narration']],

  // ── AI features ──
  ['Voice Q&A Tutor', 'feature',
    '"Ask the Trainer" widget in every module. Type a question → grounded answer from that module’s slides → optional spoken reply (Darryl voice). Defers to the WISH admin when out of scope. `POST /api/tutor/ask`.',
    ['WISH Training', 'Tutor Analytics', 'OpenAI', 'Narration', 'Modules']],
  ['Tutor Analytics', 'feature',
    'Every tutor question logged with a content-gap flag. Admin "Tutor" tab shows volume, per-module breakdown, content gaps (what the course didn’t answer), and recent questions.',
    ['Voice Q&A Tutor', 'Admin Panel']],
  ['OpenAI', 'ext', 'gpt-4o-mini powers the tutor answers and the email agent. Whisper used for demo verification (STT).', ['Voice Q&A Tutor', 'Gmail Agent', 'Enrollment & Email Agent']],

  // ── Enrollment / integration ──
  ['Enrollment & Email Agent', 'feature',
    'Manager emails a WISH permission form (.docx) → agent parses it → maps checked boxes to modules → generates credentials → enrolls + emails the employee. See ENROLLMENT.md.',
    ['WISH Training', 'Permission to Module Mapping', 'Gmail Agent', 'Roster', 'OpenAI', 'ESS Integration']],
  ['Permission to Module Mapping', 'feature',
    'Deterministic table: each permission checkbox → a module id. Not AI, so it can’t drift. State/branch modules (California) assigned by branch, not the form.',
    ['Enrollment & Email Agent', 'Modules', 'ESS Integration']],
  ['Gmail Agent', 'feature',
    'Polls gahnr434@gmail.com every 60s via Gmail OAuth2; parses .docx forms. NOTE: refresh token needs re-auth (blocker for the email path).',
    ['Enrollment & Email Agent', 'OpenAI']],
  ['ESS Integration', 'feature',
    'Training embedded as a tab inside ess.schedulingsite.com. SSO auto-login, cross-origin embed, branch-based module assignment. See INTEGRATION.md.',
    ['WISH Training', 'SSO', 'Enrollment & Email Agent', 'Permission to Module Mapping', 'California Breaks Demo']],
  ['SSO', 'feature', 'HS256 JWT (shared SSO_SECRET) at `POST /api/sso`; client auto-logs in from a `?sso=` token so ESS users land straight in.', ['ESS Integration']],

  // ── Platform ──
  ['Admin Panel', 'feature',
    '/admin — content editor (slides + quiz), History/restore, Users, Roster, Trouble-Spots analytics, and the new Tutor Q&A tab.',
    ['WISH Training', 'Tutor Analytics', 'Quiz', 'Roster', 'Database']],
  ['Quiz', 'feature', 'Per-module quiz (86 questions). Wrong-answer rates feed the Trouble-Spots analytics.', ['WISH Training', 'Modules', 'Admin Panel']],
  ['Certificate', 'feature', 'Completion certificate (on-screen + PDF download) with the WISH banner. Issued when assigned modules are done.', ['WISH Training', 'User Progress']],
  ['User Progress', 'feature', 'Per-user slide/module progress synced to PostgreSQL on every update; drives completion + the certificate.', ['WISH Training', 'Roster', 'Database']],
  ['Roster', 'data', 'Enrolled employees: email, name, assigned_modules, username, password, requester (manager) email.', ['Enrollment & Email Agent', 'User Progress', 'Admin Panel']],

  // ── Infra ──
  ['Database', 'infra', 'PostgreSQL on Railway: course_data, quiz_data, history, user_progress, roster, narration_cache, analytics_counts, tutor_questions. Source of truth (JSON files are seeds).', ['WISH Training', 'Admin Panel', 'Deploy & Railway']],
  ['Deploy & Railway', 'infra', 'Deploy = `git push` → Railway project `Wish-course` auto-deploys from main. `client/build/` is committed (Railway runs npm install only). `./deploy.sh` handles it.', ['WISH Training', 'Database']],
  ['Tech Stack', 'infra', 'React (CRA, pre-built) + Express v5 (CJS) + PostgreSQL on Railway. Narration = ElevenLabs; AI = OpenAI gpt-4o-mini.', ['WISH Training', 'Database', 'Deploy & Railway']],
  ['Mobile', 'feature', 'Responsive learner flow (useIsMobile + SimFrame zoom). Dashboard/player/quiz/tutor all fit phones; demos get the Fullscreen mode.', ['WISH Training', 'SimFrame', 'Fullscreen Demo Mode']],
  ['Gotchas', 'infra',
    'Hard-won lessons. (1) `.form-input/.form-select` carry min-width:175/185px — override with min-width:0 or table fields balloon. (2) `position:fixed` inside a transformed ancestor is confined to it — portal to <body>. (3) Root cause > symptom. See SYSTEM.md.',
    ['WISH Training', 'Interactive Demo Engine', 'SimFrame', 'Fullscreen Demo Mode']],

  ['Modules', 'hub',
    `The ${modules.length} training modules. Each is an independent, assignable unit.`,
    ['WISH Training', ...modules.map(m => safe(m.name))]],
];

// ── Generate one note per module (linked from Modules + to demos/mappings) ────
for (const m of modules) {
  const hasDemo = (m.slides || []).some(s => s.simulation_url);
  const links = ['Modules', 'Permission to Module Mapping'];
  if (hasDemo) links.push('Interactive Demo Engine');
  if (m.id === 'california_breaks') links.push('California Breaks Demo', 'ESS Integration');
  if (m.id === 'payroll_processing') links.push('Manage Process Hours', 'Sign-Out Exceptions');
  if (m.id === 'manual_process_hours') links.push('Manage Process Hours');
  const desc = `Module — ${(m.slides || []).length} slides${hasDemo ? ', includes interactive demo(s)' : ''}. id: \`${m.id}\`.`;
  nodes.push([safe(m.name), 'module', desc, links]);
}

// ── Link-integrity check: every [[link]] must resolve to a generated note ─────
const titles = new Set(nodes.map(n => n[0]));
const broken = [];
for (const [title, , , links] of nodes) for (const l of (links || [])) if (!titles.has(l)) broken.push(`${title} → [[${l}]]`);
if (broken.length) { console.error('BROKEN LINKS:\n  ' + broken.join('\n  ')); process.exit(1); }

// ── Write notes ───────────────────────────────────────────────────────────────
fs.mkdirSync(VAULT, { recursive: true });
let written = 0;
const statusCount = { done: 0, draft: 0, blocked: 0 };
for (const [title, tag, desc, links] of nodes) {
  const status = STATUS[title] || 'done';
  statusCount[status]++;
  const body =
`---
tags: [wish, ${tag}, status/${status}]
status: ${status}
---
# ${title}

${desc}

## Related
${(links || []).map(l => `- [[${l}]]`).join('\n')}
`;
  fs.writeFileSync(path.join(VAULT, safe(title) + '.md'), body);
  written++;
}

// ── Color the graph automatically: merge status color-groups into .obsidian/graph.json
const rgb = hex => parseInt(hex.replace('#', ''), 16);
const statusGroups = [
  { query: 'tag:#status/blocked', color: { a: 1, rgb: rgb('#E53935') } }, // red
  { query: 'tag:#status/draft',   color: { a: 1, rgb: rgb('#F59E0B') } }, // amber
  { query: 'tag:#status/done',    color: { a: 1, rgb: rgb('#10B981') } }, // green
];
const graphPath = path.join(VAULT, '..', '.obsidian', 'graph.json');
try {
  let g = {};
  if (fs.existsSync(graphPath)) { try { g = JSON.parse(fs.readFileSync(graphPath, 'utf8')); } catch {} }
  const others = (g.colorGroups || []).filter(x => !String(x.query || '').includes('status/')); // drop old status groups
  g.colorGroups = [...statusGroups, ...others]; // status first → wins on ties
  fs.mkdirSync(path.dirname(graphPath), { recursive: true });
  fs.writeFileSync(graphPath, JSON.stringify(g, null, 2));
  console.log('Graph color-groups written to .obsidian/graph.json');
} catch (e) {
  console.warn('Could not write graph.json (open Graph → Groups to color manually):', e.message);
}

console.log(`Wrote ${written} notes to:\n  ${VAULT}`);
console.log(`Status — done: ${statusCount.done}, draft: ${statusCount.draft}, blocked: ${statusCount.blocked}`);
console.log(`Open the vault in Obsidian → Graph view (green=done, amber=draft, red=blocked).`);
