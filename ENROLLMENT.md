# WISH Enrollment — Permission Form → Module Assignment

_The "bridge" that fulfills a training request when a manager emails a WISH permission form.
Last updated 2026-06-23._

We have the content (21 modules, narration, quizzes, interactive demos) and the ESS embed path.
This doc covers the **enrollment bridge**: a manager emails a `.docx` permission form → the right
employee gets the right modules, automatically. It also covers the **GPT/OpenAI cost** and **what's
missing** to make this path fully live.

---

## 1. What the bridge does

```
Manager emails WISH permission form (.docx)  ──►  AI email agent (gpt-4o-mini)
   to gahnr434@gmail.com                            • reads the inbox every 60s
                                                     • parses the form (name, email, checked boxes)
                                                     • maps checked permissions → module IDs
                                                     • generates username + password
                                                     • writes to the roster
                                                     • emails the employee their credentials + modules
                                                     • notifies the manager when the employee finishes
```

The employee then logs in (standalone now, or the WISH ESS tab later) and completes their assigned
modules. **No human touches it between the email and the enrollment.**

Files: `server/gmail.js` (Gmail OAuth + `.docx` parser `parseWishForm`), `server/agent.js`
(gpt-4o-mini loop + `enroll_user`), `server/email.js` (invite / completion / manager-notify templates).

---

## 2. End-to-end flow

1. **Inbox poll** — every **60s** the agent fetches unread email from `gahnr434@gmail.com` (Gmail API, OAuth2).
2. **Parse** — `parseWishForm` unzips the `.docx`, reads `word/document.xml`, and extracts:
   - Employee **Name**, Employee **Email**
   - **Checked** permission boxes only (`<w14:checked w14:val="1">`) — unchecked are ignored
   - Handles both form formats (colon-label and no-colon). Supports **multiple forms per email** (batch).
3. **Map** — `mapPermissions()` runs each checked label through the **`PERMISSION_TO_MODULE`** table
   (deterministic, not AI — see §3). Everyone also gets `introduction`.
4. **Enroll** — generates a username (`FLastName`, e.g. `KDeLaO`) + password (4 letters + 4 digits),
   upserts the `roster` row with `assigned_modules`, and stores the requester (manager) email.
5. **Invite** — emails the employee their username, password, and the list of modules to complete.
6. **Completion** — when the employee finishes their assigned modules, the manager gets a
   "WISH Training Complete — [Name]" email.

The model's only job is to read the form and call `enroll_user`. The **which-modules** decision is the
fixed table, so it can't drift or hallucinate.

---

## 3. Permissions → Modules (the format)

Deterministic mapping in `server/agent.js`. Lowercase + trim the checked label, then look it up.
Unmatched labels are **skipped** (see §6).

| Permission checkbox (form label) | Module ID |
|---|---|
| _(always, everyone)_ | `introduction` |
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

> **Not on the form:** state/branch-based modules like **`california_breaks`** are assigned by the
> employee's **branch**, not by a checkbox (the form has no state field — and we won't add one).
> See `INTEGRATION.md` §2.1.

---

## 4. Cost — OpenAI / GPT API

The agent uses **`gpt-4o-mini`** only (not Anthropic). Pricing (verify current rates at
platform.openai.com/pricing): **~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens.**

- Each call logs usage: `[agent] tokens — in: X, out: Y, total: Z`.
- A typical enrollment runs the agentic loop a couple of times (read form → call `enroll_user` →
  summarize) for roughly **~20K total tokens**, mostly input.
- **Per enrollment email: ≈ $0.003–0.005** (well under one cent).

**Monthly projection (illustrative):**

| Enrollments / month | Approx. GPT cost |
|---|---|
| 100 | ~$0.40 |
| 500 | ~$2 |
| 5,000 | ~$20 |

**Cost is effectively negligible.** The real constraint on this path is **not** GPT spend — it's the
Gmail OAuth (see §6). Narration (ElevenLabs) is a separate, one-time pre-generation cost, not per-enrollment.

---

## 5. What we have ✅

- **21 modules** with narration, quizzes, and interactive demos (incl. the California module).
- **The email agent**, end to end: inbox poll, `.docx` parsing (both formats), batch enrollment,
  deterministic permission→module mapping, credential generation, invite email, manager completion notice.
- **Roster + per-user progress + admin panel** (content editor, users, roster, analytics, history).
- **Admin enrollment API** (`POST /api/admin/roster`) — bypasses the agent, useful for testing or for
  ESS to call directly.
- **ESS integration** spec + built SSO endpoint + cross-origin demo (so the same enrollment surfaces
  inside the WISH ESS tab).

---

## 6. What's missing / blockers ⚠️

1. **🔴 Gmail OAuth token is EXPIRED (`invalid_grant`) — the agent cannot read its inbox right now.**
   Verified 2026-06-22. Most likely the Google OAuth consent screen is in **"testing"** mode, where
   refresh tokens **expire after 7 days**. Last agent activity was ~late May.
   **Fix:** re-authorize Gmail (run `scripts/gmail-auth.js` to mint a new refresh token, update
   `GMAIL_REFRESH_TOKEN`) **and move the consent screen to "production"** so tokens stop expiring weekly.
   _This is the #1 thing blocking the email-form path._
2. **State/branch modules** can't be auto-assigned from the email path — the form has no branch/state.
   `california_breaks` is assigned by branch (ESS) or manually. Fine by design; just note the email
   agent won't add it.
3. **Unmatched permission labels are silently skipped** — if a form uses different wording, that module
   is dropped with no error. Recommend the agent flags unmatched boxes back to the requester/admin.
4. **No auto-reminders / manager digest** — e.g. 7-day / 14-day "you haven't started" nudges, or a
   weekly supervisor summary. Scoped, not built.
5. **Admin/API hardening** — `POST /api/admin/roster` uses the admin password today; issue a dedicated
   service key before ESS calls it in production.

---

## 7. Two ways to fulfill the request — pick per phase

| | A. Email agent (now / interim) | B. ESS-native (recommended long-term) |
|---|---|---|
| Trigger | Manager emails the `.docx` form | ESS processes the permission grant |
| Maps boxes → modules | The agent (`PERMISSION_TO_MODULE`) | ESS, using the §3 table, then calls the API |
| Enrolls via | `enroll_user` → roster | `POST /api/admin/roster` |
| State/branch modules | Not available (no branch on form) | ESS appends them (it knows the branch) |
| Dependency | Gmail OAuth (needs upkeep) | None — no Gmail, no token to babysit |

**Recommendation:** **B** is the durable answer — when ESS owns enrollment, the Gmail fragility goes
away entirely and state/branch modules work. **A** is the bridge for right now and for managers who
just email forms. Both end at the same enrollment, so the permission→module format is identical.

---

## 8. To make the email path live — checklist

- [ ] **Re-authorize Gmail** (`scripts/gmail-auth.js`) → set new `GMAIL_REFRESH_TOKEN`.
- [ ] **Move the Google OAuth consent screen to "production"** (stops 7-day token expiry).
- [ ] Confirm `OPENAI_API_KEY` is set (it is) and the agent boots (`agent.start(pool)` on server start).
- [ ] Send a test form via `scripts/send-batch-test.js` (uses test emails — never real staff).
- [ ] (Recommended) Add **unmatched-permission flagging** so dropped modules surface to the requester.
- [ ] (Recommended) Add **auto-reminders** + a **weekly manager digest**.
