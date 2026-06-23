# WISH Training — Integration Spec (WISH ESS)

_For the ProtaTECH / WISH ESS engineering team. Last updated 2026-06-22._

This document describes how to embed the WISH Training portal as a **Training tab inside WISH ESS
(`ess.schedulingsite.com`)**, and how training modules are **auto-assigned from the WISH permission
form** — the checked permission boxes map deterministically to training modules.

The training app is a self-contained web app (React + Express + PostgreSQL). It is **already
embeddable** (no `X-Frame-Options` / frame-blocking headers) and exposes a small, stable API. ESS
does **not** rebuild anything — it adds a tab and makes a few API calls.

- **App base URL (current):** `https://www.wishtrainingtest.com` (host on ProtaTECH infra at handoff)
- **Admin panel:** `/admin`
- **Repo:** `github.com/jesus3630/wish-course` · see also `INVENTORY.md`, `SYSTEM.md`, `CLAUDE.md`

---

## 1. The model in one picture

```
Manager emails WISH permission form
        │  (checked boxes = permissions granted)
        ▼
Permissions parsed  ──►  PERMISSION_TO_MODULE map  ──►  assigned_modules[]
        │                                                     │
        ▼                                                     ▼
   (real WISH access)                          POST /api/admin/roster  (enroll, keyed by email)
                                                              │
Employee logs into WISH ESS ──► clicks "Training" tab ──► iframe app
        │                                                     │
        ▼ (SSO: ESS passes employee identity)                ▼
   app identifies the employee ──► loads THEIR assigned_modules ──► they train
                                                              │
                                                              ▼
                              GET /api/progress/:email  ──►  ESS shows completion
```

The permission form is the **single source** for both the employee's real WISH access **and** their
training assignment — same checked boxes, same identity.

---

## 2. The core rule — checked boxes → modules

This is deterministic, not AI. Each checked permission on the form maps to exactly one training
module; everyone also gets `introduction`. (Implemented today in `server/agent.js` →
`PERMISSION_TO_MODULE` + `mapPermissions`.)

| Permission checkbox (form label) | Training module ID |
|---|---|
| _(always, for everyone)_ | `introduction` |
| Record Maintenance | `record_maintenance` |
| Manage Job | `manage_job` |
| MSS | `mss` |
| Scheduling | `scheduling` |
| Schedule by Job Admin | `schedule_by_job_admin` |
| Payroll Processing | `payroll_processing` |
| General Reporting | `general_reporting` |
| Payroll Reporting | `payroll_reporting` |
| Admin Reporting | `admin_reporting` |
| Workforce Scheduler Maintenance | `workforce_scheduler_mntnnce` |
| Workforce Admin Maintenance | `workforce_admin_maintenance` |
| Employee HR Record Maintenance | `employee_hr_record_maintenance` |
| Hiring Manager | `hiring_manager` |
| HR Admin / Hiring Admin | `hiring_admin` |
| Mail By | `mail_by` |
| Sign-In / Sign-Out | `sign-in__sign-out` |
| Manual Process Hours | `manual_process_hours` |
| Billing | `billing` |
| Inventory | `inventory` |

**Matching rules:** lowercase + trim the label, then look it up. Unchecked boxes are ignored. A
label that doesn't match any key is **skipped** — see §8 (recommend surfacing unmatched labels rather
than silently dropping).

> Example (verified against a real form): Kirsten De La O's form had 9 boxes checked →
> `["introduction","record_maintenance","manage_job","mss","scheduling","schedule_by_job_admin",
> "general_reporting","admin_reporting","mail_by","sign-in__sign-out"]`.

### 2.1 State / branch-specific modules (NOT from the permission form)

Some modules are **location-based, not permission-based** — e.g. **`california_breaks`** (California
Meal & Rest Breaks, AB 1512). The permission form has **no state field, and we do NOT add one** (a
mis-selected state is a compliance liability). Instead, these modules are assigned by the employee's
**branch**, which already determines the state (e.g. "San Francisco" is a California branch).

**Assignment rule:** ESS already knows each employee's branch/location, so when ESS enrolls someone it
**appends state-specific modules** to the permission-derived list:

```
assigned_modules = [ <permission-based modules from §2> ]
                 + (employeeBranchIsCalifornia ? ["california_breaks"] : [])
```

ProtaTECH maintains the branch→state mapping (which branches are in California). No change to the
permission form, no state-selection liability. Until ESS wires this, California branch admins assign
`california_breaks` manually (admin panel, or `POST /api/admin/roster` with it in `assigned_modules`).
The module is a clean, independent unit — toggled in or out per employee.

---

## 3. Integration surface — four pieces

### A. Embed the Training tab
Add a tab/route in ESS that renders the app in an iframe:

```html
<iframe
  src="https://<training-host>/?sso=<TOKEN>"
  style="width:100%;height:100%;border:none"
  title="WISH Training"
  allow="autoplay"></iframe>
```

The app is responsive and already runs its interactive demos in a nested iframe, so framing is fine.
No frame-blocking headers are set. (If ESS wants to restrict who may frame it, we can add a
`Content-Security-Policy: frame-ancestors ess.schedulingsite.com` — say the word.)

### B. SSO / identity hand-in (the one real integration task)
The app must know **which employee** is viewing the tab so it can show *their* modules. ESS passes the
logged-in employee's identity. Recommended: a short-lived **signed token** (JWT, HS256) with a shared
secret, delivered via the iframe `?sso=` param or `postMessage`.

```jsonc
// JWT payload
{
  "email": "employee@example.com",   // REQUIRED — the identity key (must match the roster email)
  "name":  "Kirsten De La O",         // optional, for display
  "employee_id": "4122000",           // optional, alternate key
  "iat": 1750000000,
  "exp": 1750003600                    // short TTL (e.g. 1 hour)
}
```

**✅ BUILT.** The app verifies the signature, trusts the `email`, and loads that employee's assignment.

- **ESS side:** sign an HS256 JWT with the shared `SSO_SECRET`, put it in the iframe URL:
  `https://<training-host>/?sso=<JWT>`. Required claim: `email`. Optional: `name`, `employee_id`,
  `exp` (recommended — short TTL).
- **App side:** on load it reads `?sso=`, calls `POST /api/sso { token }`, and on success auto-logs
  the employee in (no login screen) showing their assigned modules. Endpoint:

```
POST /api/sso
{ "token": "<HS256 JWT signed with SSO_SECRET>" }
→ 200 { "ok": true, "email": "...", "name": "...", "assigned_modules": [...] | null }
→ 401 invalid_token   → 503 sso_not_configured (SSO_SECRET unset)
```

Set `SSO_SECRET` in the app's env and share it with ESS. No JWT library needed on our side
(HS256 = HMAC-SHA256, verified with Node's built-in `crypto`, constant-time). Until ESS wires SSO,
the username lookup in §C/login still works as an interim.

### C. Assign modules (enroll) — when permissions are granted
When ESS/WISH grants an employee their permissions (or when the permission form is processed), call:

```
POST /api/admin/roster
Authorization: Bearer <ADMIN_OR_SERVICE_TOKEN>
Content-Type: application/json

{
  "email": "employee@example.com",        // REQUIRED — identity key (lowercased server-side)
  "name": "Kirsten De La O",
  "assigned_modules": ["introduction","record_maintenance","scheduling", ...],  // from §2 map
  "username": "KDeLaO",                    // optional (interim username login)
  "requester_email": "manager@example.com" // optional — who requested (for completion notices)
}
→ 200 { "ok": true }
```

Upsert by `email` — calling again updates the assignment (e.g., permissions change → re-send the new
`assigned_modules`). **ESS computes `assigned_modules` from the checked boxes using the §2 table.**

> Auth note: this route currently uses the admin Bearer token (obtain via `POST /api/admin/login`
> `{password}`). For server-to-server use we recommend issuing ESS a **dedicated API key** instead of
> sharing the admin password — a small hardening we'll add at handoff.

### D. Read completion
To show training status inside ESS (per employee):

```
GET /api/progress/:email
→ 200 {
    "user_name": "...",
    "modules": { "<module_id>": { "completed": true, "last_slide": 9, ... }, ... },
    "last_synced": "2026-06-22T..."
  }
→ 404 if the employee hasn't started yet
```

Count `modules` where `completed === true` against the employee's `assigned_modules` to get
"X of N complete". (Optionally we can add a compact `GET /api/admin/users` summary — already exists —
or a webhook on completion.)

---

## 4. Where the automation triggers — two options

| | A. Email-driven (today) | B. ESS-native (recommended) |
|---|---|---|
| Trigger | Manager emails the `.docx` form to the agent inbox | ESS processes the permission grant |
| Who maps boxes→modules | The agent (`PERMISSION_TO_MODULE`) | ESS, using the §2 table, then `POST /api/admin/roster` |
| Pros | Zero change to how managers work | No email, no Gmail OAuth to maintain, instant |
| Cons | Depends on Gmail OAuth (token upkeep) | ESS wires the permission flow to the enroll call |

**Recommendation:** build **B** (the permission grant *is* the training trigger), keep **A** as an
interim bridge. Both end at the same `POST /api/admin/roster`, so the checked boxes drive training
either way.

---

## 5. Identity matching (the linchpin)

For modules to appear in the right employee's tab, the **enroll `email`** (§C) and the **SSO `email`**
(§B) must be the **same key**. The permission form already carries Employee Email, and ESS knows the
logged-in employee — so use the employee's email (or a stable employee ID, if ESS prefers) as the
shared key on both sides. Lowercase/trim for comparison (the API already lowercases).

---

## 6. Content editing after handoff (no developers)

ProtaTECH's content team edits everything in `/admin` (password-protected; move to ESS SSO/role at
handoff):
- **Slide scripts** — narration auto-regenerates from the new text (ElevenLabs).
- **Quiz questions** — add/edit per module.
- **Interactive demo wording** — the "Interactive Demo Prompts" editor rewords any demo step.
- **History / restore** — every save is snapshotted and reversible.

Only **new demo steps/screens** require a developer (edit `client/public/mockup/mockup.html`, then
deploy). See `SYSTEM.md`.

### 6.1 Where content + demos live, and how they move to your database

| Asset | Lives in | Travels how | Edited by |
|---|---|---|---|
| Slide scripts, quiz, demo-prompt overrides | **Database** (seeded from `course_data.json` / `quiz_data.json`) | First boot on an empty DB seeds from the committed JSON | Admin panel (no code) |
| Interactive demos (the engine + every screen) | **`client/public/mockup/mockup.html`** (a repo file, not the DB) | Travels with the code automatically | Developer edits the file + deploys (`SYSTEM.md`) |
| Narration audio, screenshots, React build | Committed files in `client/build/` | Travel with the code | Auto-regenerated / rebuilt |

**Moving to your own database:** set `DATABASE_URL` to your new (empty) Postgres and boot. On first
boot the server seeds it from `course_data.json` + `quiz_data.json` → you get the course **exactly as
it is now**. _(Verified: a fresh empty DB reproduced 20 modules / 171 slides / 94 demos / 86 quiz
questions with 0 differences.)_ The demos serve from the repo file regardless of database.

### 6.2 Keep the repo as the source of truth (don't re-trap content in a DB)

Edits made in `/admin` write to **your** database. To fold them back into the repo so it always holds
the canonical, portable content:

```
node scripts/export-content.js https://<your-app-url>   # pulls live content → course_data.json + quiz_data.json
git add course_data.json quiz_data.json && git commit -m "Snapshot content"
```

Run this after a round of admin edits. A fresh database then seeds to that exact state. This is how
you guarantee the scripts + demos "stay packaged as you see them" — nothing is ever stuck only in a
database.

---

## 7. Hosting & deploy

- **Option 1 (lowest ops):** keep the app on Railway; ESS points the tab at its URL. Deploys happen
  via `git push` (auto-deploy). Zero infra for ESS.
- **Option 2 (their infra):** standard Node 18+ + PostgreSQL. `npm install` → run `server/index.js`
  (serves the pre-built React client + static audio/screens). Env vars below. Schema auto-creates on
  first boot; seed from `course_data.json` / `quiz_data.json`.

**Env vars:** `DATABASE_URL`, `ADMIN_PASSWORD`, `ELEVENLABS_API_KEY` (+ `ELEVENLABS_VOICE_ID`),
`OPENAI_API_KEY` (only if using the email agent), `GMAIL_*` (only for the email agent), `NODE_ENV`.
For SSO: a shared **`SSO_SECRET`** (set this + share with ESS — the `/api/sso` endpoint is built).
For ESS server-to-server enroll: a dedicated API key (recommended hardening).

---

## 8. Security & hardening checklist (at handoff)

- [ ] **Service token** for ESS → enroll (don't share the admin password).
- [x] **SSO verify endpoint** (`/api/sso`) built — just set/share `SSO_SECRET`; use a short token TTL.
- [ ] **Admin panel** behind ESS SSO/role instead of a static password.
- [ ] **`frame-ancestors`** CSP locking embedding to `ess.schedulingsite.com`.
- [ ] **Unmatched-permission handling** — when a form box doesn't map to a module, surface it to the
      requester/admin instead of silently dropping (prevents "why didn't I get module X?").
- [ ] Rotate `JWT_SECRET` / `ADMIN_PASSWORD` from current dev values.
- [ ] Confirm single source of truth (one deployment / one DB — consolidated 2026-06-22).

---

## 9. Quick reference — API summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/admin/login` | password | Get admin token |
| POST | `/api/admin/roster` | admin/service | **Enroll / assign modules** (upsert by email) |
| POST | `/api/sso` | none (signed token) | **Verify ESS SSO token** → email + assigned_modules |
| POST | `/api/login` | none | Identify a user by username → email + assigned_modules (interim) |
| GET | `/api/progress/:email` | none | **Read completion** for an employee |
| GET | `/api/admin/users` | admin | All users + completion summary |
| GET | `/api/course` · `/api/quiz` | none | Course + quiz content |

_Remaining optional adds for ESS: a dedicated ESS service key (vs admin password), and a completion
webhook. `/api/sso` is built._
