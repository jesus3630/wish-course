# Manual Process Hours — New UI Spec

Source: Jesus ↔ Daryl transcript (2026-07-20). This is the filtered signal —
everything below is what must be reflected in the new UI and the training flow.
Items marked **[OPEN]** need a decision from Daryl before I build them.

---

## 1. What this screen IS (framing for the training)

- The new **Manage Process Hours** screen is an **after-the-event** review/approval
  tool. The payroll person opens it *once the event is over* to see what the
  electronic sign-in captured, review times, and approve hours.
- It is **not** used live at the sign-in post. Staff are explicitly taught **not**
  to be in here during sign-ins/sign-outs — they can corrupt data. Reviewing/
  approving happens afterward.
- This replaces the OLD process-hours screen (reached under Tools), which "is
  going to go away." Rollout is gradual — some people use the new screen now,
  everyone eventually.

## 2. Where it lives (navigation) — CONFIRMED via screenshots 2026-07-21

- **Enter the new MSS:** (old shell) **Tools → Manager Portal (NEW MSS)** →
  lands on the new MSS **Home** ("Upcoming Events").
- **Manual Process Hours IS the "Approvals" screen** in the new MSS sidebar.
  Flow: click **Approvals** → type Job# → **Search** → summary bar + shift rows.
- New MSS left nav (top→bottom): Home, Deployments, **Approvals**, Call-Sign
  Setup, Event Setup, Payroll, Reports, Tools.
- **Visual tell you're on the NEW screen:** the refreshed colorful WISH logo +
  hamburger, "Menu" sidebar with blue icon tiles, avatar + name top-right.

### Approvals screen — exact fields (from screenshots)
- Row 1: **Job#** (placeholder "Job No"), **Branch Name*** (Prota LA Branch Test),
  **StartDate*** (date), **FinishDate*** (date).
- Row 2: **Event Name*** (Select), **Venue Name** (All), **Job Name*** (Select),
  **Designation** (All).
- Row 3: **View** (ManProc) · checkboxes **Un-Approved Breaks / Not Signed-In /
  Not Signed-Out** · blue **Search** button.
- Row 4: radios **Expand / Collapse**.
- After Search: **yellow summary bar** — `Total  Sched=11  SignedIn=3
  SignedOut=1  Deployed=0  OnMealBreak=0  OnRestBreak=0` (white text — this is the
  bar Daryl flagged for a possible blue+dark restyle; replicated as-is for now).
- Shift row (collapsed): green **+** expander · `Role Name - Event Staff` ·
  `ShiftNo - 1` · `Shift Name - load in` · `Start Time - Jul 16 2026 12:00` ·
  `End Time - Jul 16 2026 22:00` · buttons **Create Sched** (green),
  **Auto-Fill** (green), **NS** (red) · centered blue **Approve Hours**.

### Build status (scratch preview, pixel-matched — not yet in engine)
- ✅ New MSS **Home** shell — matches screenshot 136.
- ✅ **Approvals** empty form — matches 137.
- ✅ **Approvals** searched/collapsed — matches 138.
- ⏳ NEED: **expanded shift** (green + → individual employees w/ sign-in/out
  times, the blue **Edit** control + **pencil/Notes**), and the **post-approval**
  state (success toast + **gold stars**). These drive slides 4–7.

## 3. Status color system — THIS IS THE STANDARD (course-wide)

| State | Indicator |
|---|---|
| Not signed in / no times | **Red** |
| Signed in / good to go | **Green** (arrows turn red → green on sign-in) |
| Hours approved / processed | **Gold star** (replaces the old "sunburst") |
| Not yet processed | **Blue link** |

- Gold stars appear on the **left**, next to completed shifts, and are the
  "where am I" tracker. They preferred **gold stars over the sunburst**.

## 4. The summary "glance" bar — NEEDS A REDESIGN

- A bar at the top shows at-a-glance counts: **Scheduled #** and **Sign-in #**
  (e.g., "Sign in = 3").
- **Problem:** currently **yellow background with white text** — poor contrast,
  glare, easy to miss ("went right over my head"). This is important glance info,
  so readability matters.
- **Change to: blue background with dark/near-black text.** **[OPEN]** — they
  leaned blue+dark but weren't 100% locked. Confirm final colors.

## 5. Report filter checkboxes — KEEP (well-liked)

- Above the summary bar, checkboxes: **Unapproved hours**, **Not signed in**,
  **Not signed out**.
- Checking a box **instantly filters the list** to that report. Toggling to
  "Not signed out" shows only those individuals. Daryl liked this a lot — it
  "clears out information you're not looking at."

## 6. Auto-fill (green button) + paper vs electronic paths

- **Electronic sign-in path:** if electronic sign-ins were done, each employee's
  times are **already populated** → review → approve.
- **Paper sign-in path:** use the **Sign-In / Sign-Out buttons** to populate ALL
  employees with the **scheduled time**, then use **Tab** to manually adjust
  individual times.
- **Green Auto-fill button:** fills the sign-in (e.g., 1000) and sign-out (2200)
  times. **Critical rule: it only fills what is EMPTY — it never overwrites times
  already entered** (e.g., existing 04:15 times are left untouched). Separate
  auto-fill for sign-in and sign-out.

## 7. Approve / Edit / Notes — the confusing part, fix it

- Each employee row has a **collapsible arrow** (side = collapsed, down = open →
  reveals sign-in time).
- **Approve Hours = the SAVE button.** It finalizes the hours. Done one at a time.
- On success: **"Hours approved successfully" toast, top-right.** They love it —
  keep it. Gold stars appear after approval.
- **Edit vs Notes affordance bug:**
  - The **pencil icon** is currently **Notes** (adds a workforce note; free text;
    persists and re-displays).
  - The real **Edit** is a separate **blue control on the right** — it opens
    start-time / end-time fields → **Update**.
  - This confuses users because a pencil universally reads as "edit."
  - **[OPEN]** — proposed fix: make the pencil = **Edit time**, with the note
    attachable to that edit. Confirm before I change the affordance.
- **[OPEN]** — do Notes persist to the employee's record, and who can see them?
  Daryl's guess: notes only surface on the sign-in/sign-out report (like the old
  system). Needs confirmation — affects what the training says.

## 8. "Tasking" / self-test mode (Daryl added this — keep it)

- Daryl built a variant where the demo **tasks** the learner instead of
  instructing — **no hints**. Ends with **"Assessment completed 5 out of 5."**
  This maps to our existing graded "Test Yourself" mode.
- Slide 3 tasking sequence (no hints): Open Payroll menu → Manage Process Hours →
  select event from dropdown → Retrieve → click Shift Name → open it → 5/5.

---

## 9. Corrected slide flow (Manual Process Hours)

- **Slide 3 — Accessing / Reviewing:** glance view of what electronic sign-in
  captured after the event. Payroll person reviews. Supports tasking/graded
  variant (§8). Nav: Payroll → Manage Process Hours → select event → Retrieve →
  open Shift Name.
- **Slide 4 — Approving Hours:** open a shift role → electronic times
  pre-populated → review → **Approve Hours (save/finalize)** → top-right success
  toast → gold stars appear.
  - **FIX:** this slide currently has **too much info** and is confusing. The
    gold-star + paper-sign-in content is **out of place here** (it partly belongs
    to the other/old screen). Trim slide 4 to the electronic review→approve path;
    move paper/auto-fill detail to slide 5.
- **Slide 5 — Autofill & Bulk Approval:** paper path (§6) — Sign-In/Sign-Out
  buttons populate scheduled time, Tab to adjust, green Auto-fill fills only
  empty times, then approve.
- **Slides 6–7 (No-Shows, Override Rates/Per Diem):** unchanged content, restyle
  to new UI. Sign-Out **Exceptions** report (Payroll) still handles overlapping /
  negative hours (remove a doubled/overlapping person via the exception report).

---

## 10. Build approach & practice data

- Re-skin is **scoped to Manual Process Hours first** (new-UI flag/class), so the
  other 19 modules stay on the current look until the new UI is approved.
- Practice data from the transcript: branch **"Prota LA Branch Test"**, event
  **"A DAY EVENT"**, job **"A Day Job"**, ~10 scheduled employees. (Randomize
  employee names/numbers per the demo rule — no real staff data.)
- Expect iteration ("ready to break everything down and build it back up
  tomorrow"). Don't over-engineer; build to review.

## 11. Still needed before I build

- **Screenshots of the new Manage Process Hours screen** (the form + the shift/
  approvals grid with the summary bar, checkboxes, arrows, gold stars, and the
  edit/notes controls). I'll match them closely.
