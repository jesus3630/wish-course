# WISH Training Portal — Inventory

_Last taken: 2026-06-22_

A full accounting of what's built. The product is complete and working — content, demos,
narration, quizzes, certificates, admin, analytics, and AI enrollment. What remains is
**consolidation, polish, and handoff paperwork**, not core building.

---

## At a glance

| Metric | Count |
|---|---|
| Modules | 20 |
| Total slides | 171 |
| Slides with interactive demos | 96 (>half the course is hands-on) |
| Quiz questions | 86 (across 18 modules) |
| Narration MP3s | 390 files / ~230 MB (Darryl voice, static, zero ongoing cost) |
| Real WISH screenshots | 41 |
| Demo functions (mockup engine) | 103 |
| Interactive demo engine | 13,331 lines (`mockup.html`) |
| API endpoints | 24 |
| React components | 8 |
| Git commits | 529 |
| Live deployments | 2 (see ⚠️ consolidation below) |

---

## 1. Content

- **20 modules · 171 slides.** Live content lives in PostgreSQL; `course_data.json` /
  `quiz_data.json` are seed files only.
- **96 slides carry interactive click-through demos** — over half the course is hands-on.
- **86 quiz questions** across 18 modules (4–6 each).
- **Narration:** every slide voiced (ElevenLabs "Darryl", `ELEVENLABS_VOICE_ID=Znoc6pjc2kSb9hIuR7XU`),
  served as **390 static MP3s (~230 MB)** named by `sha256(slide text)`. Word-highlight is synced
  via a companion `{hash}.json` timing file. Editing slide text auto-invalidates the hash → fresh
  generation on next play, then DB-cached.
- **41 real WISH screenshots** back the non-demo slides.

### Module list (app index → id)
1 introduction · 2 record_maintenance · 3 manage_job · 4 scheduling · 5 schedule_by_job_admin ·
6 payroll_processing · 7 general_reporting · 8 payroll_reporting · 9 admin_reporting ·
10 workforce_scheduler_mntnnce · 11 workforce_admin_maintenance · 12 employee_hr_record_maintenance ·
13 hiring_manager · 14 hiring_admin · 15 mail_by · 17 manual_process_hours · 18 billing ·
19 inventory · 20 mss

---

## 2. Interactive demo engine — the crown jewel

**`client/public/mockup/mockup.html`** (13,331 lines, 103 demo functions). The deployed copy is
`client/build/mockup/mockup.html` — auto-synced by the pre-commit git hook.

- **`runGuided(steps)`** — the "click here" walkthrough engine: arrows, step bar, completion overlay,
  per-step `{selector, prompt, onConfirm, skipClick, type, also}`.
- **`runGraded(steps)`** — the "Test Yourself" assessment engine: no hints, scored, wrong clicks
  counted, a hint appears after 2 misses, scorecard at the end. (Prototype — not yet wired into
  real modules.)
- **Routes** keyed `<module_id>-<slide>`; the slide's `simulation_url` points the player's iframe at
  the right demo.
- **Pixel-matched WISH screen replicas** built from real screenshots + the payroll training recording:
  Manage Process Hours, the shift roster (Sign-In/Sign-Out Adj, override, per-diem, NS no-show),
  Process Payroll (Get Job → Approved Hours → Start Process), scheduling, billing, hiring portals,
  mail-by, inventory, reports, the menu tour, and more.
- **Prompt overrides + introspect mode** so demo wording is admin-editable without touching code.

> Building or editing demos? See **`SYSTEM.md`** — the engine + component library + six-step build.

---

## 3. Frontend — React (CRA, pre-built, committed)

| Component | Responsibility |
|---|---|
| `App.tsx` | Login → dashboard → module flow; loads course/quiz; jump-to-slide |
| `components/ModulePlayer.tsx` | Slide player, narration + word highlight, the demo **SimFrame** (mobile scaling), centered text-only layout |
| `components/Dashboard.tsx` | Module grid, progress ring, **Quick Reference search** |
| `components/Quiz.tsx` | Quiz UI; records every answer to analytics |
| `components/AdminPanel.tsx` | Content editor, History/restore, Users, Roster, **Analytics (Trouble Spots)**, **Interactive Demo Prompts editor** |
| `components/LoginScreen.tsx` | Username + password login |
| `components/Certificate.tsx` | Completion certificate |
| `components/Character.tsx`, `VideoPlayer.tsx` | Mascot states; legacy video player |

---

## 4. Backend — `server/index.js` (Express v5, CJS) + PostgreSQL

- **24 API endpoints**: course, quiz, login, progress, full admin suite, narration fallback,
  **`/api/analytics`**, **`/api/demo-prompts`**.
- **PostgreSQL** (auto-creating schema): `course_data`, `quiz_data`, `history`, `user_progress`,
  `narration_cache`, `client_timings`, `admin_sessions`, `roster`, `analytics_counts`.
- **Boot-merge:** seeds on empty DB; on every boot applies slide-level fields from JSON
  (`simulation_url`, `screenshot`, etc.) while **preserving admin edits** to text/quizzes/demo prompts.
- **AI email enrollment agent** (`agent.js` + `gmail.js` + `email.js`): a manager emails a `.docx`
  WISH permission form → the agent (gpt-4o-mini) parses it → enrolls the employee → emails credentials
  → notifies the manager on completion.

---

## 5. Notable features

- **Quick Reference** — dashboard search over every slide (titles + narration); click a result to jump
  straight to that slide.
- **Trouble Spots analytics** — the Quiz records each answer; admin "Analytics" tab ranks quiz
  questions by % missed (color-coded); reset endpoint to wipe test data before launch. The
  `analytics_counts` table is generic, so graded-demo misses can feed the same view later.
- **Admin-editable demo prompts** — for any demo slide, admins reword each step's prompt in the panel
  (overrides stored in `slide.demo_prompts`; the mockup fetches them via `/api/demo-prompts`). Click
  logic stays in code; only text is editable.
- **Graded "Test Yourself" mode** — prototype at `/mockup/mockup.html?module=graded_demo&slide=1`.
- **Mobile polish** — demo frames stay tappable on phones (min scale + swipe-to-explore) instead of
  shrinking to nothing.
- **Centered modern layout** for text-only slides (no more small card in a sea of empty space).

---

## 6. Infrastructure & ops

- **Railway** hosting; static pre-built client committed (Railway runs `npm install` only).
- **Deploy:** `./deploy.sh "msg"` (add `--build` after React/TS changes) — syncs mockup, runs the
  protected-demo guard, commits, pushes, deploys. `./start.sh` pulls + arms hooks.
- **Git hooks** (`.githooks/`): pre-commit auto-copies mockup → build; pre-push blocks pushes missing
  protected demo functions/IDs.
- **Narration tooling:** `scripts/pregen-audio.js`. **Course import:** `scripts/update-course.js`.
- **Docs:** `CLAUDE.md` (project reference), `SYSTEM.md` (demo playbook), this file.

---

## ⚠️ Open items (honest accounting)

1. **Two duplicate deployments — resolve before handoff.** `wish-app-production.up.railway.app`
   (project `wish-course`, lowercase) and `wishtrainingtest.com` → `wish-training.up.railway.app`
   (project `Wish-course`, capital) run **separate databases** that drift. Pick one as source of
   truth and retire the other. All admin/DB edits currently must be applied to **both**.
2. **Module 6 — last two real screens.** Sign-Out Exceptions (slide 7) + Employee Time Register
   (slide 9) are still on approximated screens; each needs one screenshot to finish.
3. **Graded mode** — wire it into real modules as end-of-module checkpoints, feeding Trouble Spots.
4. **Handoff artifacts** — write the integration spec (iframe embed + SSO token + enroll/completion
   API calls + the content-editing model).
5. **Backlog** — auto-reminders (7d/14d no-login), weekly manager digest, Spanish/bilingual track,
   custom domain.

---

## Handoff readiness

WISH wants this as a **tab inside their existing site**, not a standalone website. The app is already
**embeddable** (no frame-blocking headers) and exposes the APIs needed:

- **Embed:** iframe the app in a WISH "Training" tab — runs as-is.
- **SSO (the one real integration task):** pass the logged-in WISH employee identity into the app via
  a signed token so there's no second login.
- **Assignment:** WISH calls `POST /api/admin/roster` to enroll someone (replaces the email agent).
- **Completion:** WISH reads progress back to mark trainings done.
- **Editing after handoff:** scripts, quizzes, and demo wording are all editable in the admin panel
  (no code); only new demo steps/screens need a developer + one deploy.
