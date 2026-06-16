# WISH Training Portal — CLAUDE.md

## ⚠️ Mockup — DO NOT REMOVE THESE FUNCTIONS
`client/public/mockup/mockup.html` and `client/build/mockup/mockup.html` must always contain:
- `addEditJobFormHTML()` — pixel-matched Add/Edit Job form used by manage_job slides 4 and 6
- `showAddShiftModal()` — Add Shift modal with full branch list (pixel-matched to real WISH)
- `showAddRolePanel()` — Add Role modal with 18 real role names, min/max, time fields
- `closeAddShiftModal()`, `showJobTab()`, `autoFillRoleForm()` — helpers for the above

These were destroyed twice by merge commits (1423706, 4ae7099) that pulled in stale code.
A pre-push git hook now blocks any push where these functions are missing.
If they disappear: `git show 3b4f77a:client/public/mockup/mockup.html` has the good version.

---

## What This Is
ProtaTECH's WISH (Workforce Information Systems Hosted) training course for Los Angeles County staff.
Employees complete assigned modules, take quizzes, and get certificates.

> **Building interactive demos? Read [SYSTEM.md](./SYSTEM.md) first.** It's the playbook:
> the guided engine, the reusable component library, the six-step build, and the deploy flow.

**Live site:** https://wish-app-production.up.railway.app  
**Admin panel:** https://wish-app-production.up.railway.app/admin (password: `wish2026`)  
**GitHub:** https://github.com/jesus3630/wish-course  
**Railway project:** Wish-course → service: wish-app  

---

## Stack
| Layer | Tech |
|---|---|
| Frontend | React (CRA) — pre-built, committed to repo |
| Backend | Express v5 (CJS) — `server/index.js` |
| Database | PostgreSQL on Railway |
| Hosting | Railway |
| Narration | ElevenLabs (Darryl voice) — pre-generated MP3s in `client/build/audio/` |
| Email agent | OpenAI gpt-4o-mini — polls gahnr434@gmail.com every 60s |

---

## Project Structure
```
wish-course/
├── server/
│   ├── index.js        — Express server, all API routes
│   ├── agent.js        — AI email agent (gpt-4o-mini)
│   ├── gmail.js        — Gmail OAuth2 + .docx form parser
│   └── email.js        — Email templates (invite, certificate, manager notify)
├── client/
│   ├── src/
│   │   ├── App.tsx                      — Login flow, progress sync
│   │   ├── components/
│   │   │   ├── ModulePlayer.tsx         — Slide player, narration, word highlight
│   │   │   ├── AdminPanel.tsx           — Admin content editor, history, users
│   │   │   ├── LoginScreen.tsx          — Username + password login
│   │   │   ├── Dashboard.tsx            — Module selection screen
│   │   │   ├── Quiz.tsx                 — Quiz per module
│   │   │   └── Certificate.tsx          — Completion certificate
│   │   └── utils/
│   │       └── progress.ts              — syncProgressToServer, fetchProgressFromServer
│   └── build/                           — Pre-built React app (committed to git)
│       └── audio/                       — 178 pre-generated MP3s + timing JSON files
├── scripts/
│   ├── pregen-audio.js                  — Pre-generate ElevenLabs narration
│   └── update-course.js                 — Excel storyboard → course_data.json
├── course_data.json                     — Seed file (live data is in Railway PostgreSQL)
├── quiz_data.json                       — Seed file (live data is in Railway PostgreSQL)
├── deploy.sh                            — Safe deploy script (Mac/Linux)
└── nixpacks.toml                        — Railway build config (skips React build)
```

---

## Key Concepts

### Data Lives in PostgreSQL (not JSON files)
- `course_data.json` and `quiz_data.json` are seed files only
- Live content is in Railway PostgreSQL — edit via admin panel at `/admin`
- Admin saves persist across all redeploys
- DB tables: `course_data`, `quiz_data`, `history`, `user_progress`, `roster`

### React Client is Pre-Built
- `client/build/` is committed to git including audio files (77MB)
- Railway skips the build step (see `nixpacks.toml`)
- **After any React change:** `cd client && npm run build` → commit build → deploy
- Do NOT run `npm run build` at root — it skips intentionally

### Login System
- Username: FLastName format (e.g. `JGonzalez`)
- Password: 4 uppercase letters + 4 digits (e.g. `UTQL5531`)
- Credentials stored in `roster` table, generated on enrollment

### API Endpoints (key ones)
- `GET /api/course` — all course data
- `GET /api/quiz` — all quiz data
- `POST /api/login` — user login
- `POST /api/progress` — save user progress
- `GET /api/progress/:email` — fetch user progress
- `POST /api/admin/login` — admin login
- `GET /api/admin/users` — all enrolled users + progress
- `GET /api/admin/roster` — enrollment roster

---

## Local Development

### Mac (Jesus)
```bash
cd ~/Projects/wish-course
node server/index.js        # runs on localhost:3001
# React served from client/build/ at same port
```

### Windows (collaborator)
```bash
cd wish-course
node server/index.js        # runs on localhost:3001
```

### Environment Variables (create `server/.env`)
```
DATABASE_URL=<Railway PostgreSQL URL — get from Jesus or Railway dashboard>
ADMIN_PASSWORD=wish2026
NODE_ENV=development
```

---

## Deploy

### Mac
```bash
./deploy.sh    # safe deploy — checks git status first
```

### Windows
```bash
git pull origin main
railway up --detach
```

### Manual (both)
```bash
git pull origin main                   # ALWAYS pull before deploy
railway service link wish-app          # link to correct service
railway up --detach                    # deploy
```

---

## Collaboration Rules

The everyday flow is now just two scripts — they automate the steps people kept forgetting
(pulling first, copying mockup → build, rebuilding, the protected-function check).

1. **Start of session:** `./start.sh` — pulls latest main + turns the safety hooks on.
2. **Edit content via admin panel** — not by editing JSON files directly.
3. **When done:** `./deploy.sh "what you changed"`  (add `--build` if you changed React/TS).
   It refuses to run if you're behind main, syncs the mockup, verifies the protected
   functions, then commits → pushes → deploys.

### First-time setup (run once after cloning)
```bash
git config core.hooksPath .githooks   # also done automatically by ./start.sh
```
This activates the shared hooks:
- **pre-commit** — auto-copies `client/public/mockup/mockup.html` → `client/build/mockup/mockup.html`
  so "I edited the demo but my changes don't show" can't happen.
- **pre-push** — blocks any push where the protected demo functions are missing.

### Why this prevents lost work
- **Never start stale:** `./start.sh` pulls first; `./deploy.sh` hard-stops if you're behind main.
- **Never hand-merge build files:** if branches ever conflict, rebuild with `--build` instead of
  resolving generated JS by hand (that's what wiped the mockup twice before).
- **Merge `main` into your branch daily** so a feature branch never drifts far (the painful
  merges came from a branch that fell 16 commits behind).

> ⚠️ **`client/build/` MUST stay committed.** Railway does NOT run `npm run build` — its nixpacks
> build phase is `npm install` only (the `[phases.build]` in `nixpacks.toml` is ignored). The live
> site is served from the committed `client/build/`. We tried gitignoring the JS bundle (2026-06-10)
> and it took the site down (404). To take the build output out of git later, you must FIRST make
> Railway actually run `npm run build` (fix/replace nixpacks config and verify on a test deploy).

---

## After React Changes — One Command
```bash
./deploy.sh --build "rebuild client — [what changed]"
```
This rebuilds the client, syncs the mockup, runs the guard, commits, pushes, and deploys.
(Manual equivalent still works: `cd client && npm run build` → commit `client/build` → `railway up --detach`.)

---

## Narration Audio
- All 178 slides pre-generated as static MP3s (Darryl voice, ElevenLabs)
- Files named by `sha256(slide text)` — in `client/build/audio/`
- If you edit slide text in admin panel → new hash → fresh ElevenLabs call on next play
- Pre-generate script: `node scripts/pregen-audio.js` (needs `ELEVENLABS_API_KEY` in env)

---

## AI Email Agent
- Inbox: gahnr434@gmail.com — polled every 60s
- Manager emails a WISH permission form (.docx) → agent reads it → enrolls employee → sends credentials
- Model: gpt-4o-mini (OpenAI) — NOT Claude/Anthropic
- Agent only runs when `OPENAI_API_KEY` is set in Railway env vars
- Files: `server/agent.js`, `server/gmail.js`, `server/email.js`

---

## Railway Environment Variables (Wish-Training service)
- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_PASSWORD` — wish2026
- `OPENAI_API_KEY` — powers email agent
- `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID=Znoc6pjc2kSb9hIuR7XU` — narration fallback
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_AGENT_EMAIL` — email agent OAuth
- `NODE_ENV=production`

---

## Never Do This
- Never deploy without pulling first
- Never edit `course_data.json` or `quiz_data.json` to change live content — use admin panel
- Never commit real employee emails to the repo
- Never run `npm run build` at the project root (it skips intentionally)
- Never touch `client/build/audio/` manually — it's auto-generated
