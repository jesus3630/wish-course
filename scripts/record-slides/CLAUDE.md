# CLAUDE.md — WISH Mockup Interactive Training

## What This Project Is

ProtaTECH is building a click-through interactive training course for WISH (Workforce Information Systems Hosted), used by LA County staff. The file `mockup.html` in this directory is the entire simulator — 30 guided slides across 19 modules. Trainees click highlighted elements to advance step by step.

## How to View the Mockup

**Windows:**
```
python -m http.server 8765
```
Then open: `http://localhost:8765/mockup.html`

If `python` doesn't work, try `py -m http.server 8765`

## The Core Engine

Every slide calls `runGuided(steps)` — NOT `runSeq()`. The guided engine highlights a target element with a gold pulsing border, shows a blue tooltip prompt, and waits for the user to click before advancing.

**Step object shape:**
```js
{ selector: '#element-id', prompt: 'Click Save to record the job' }
{ selector: '#input-id',   prompt: 'Type the Job Name', type: 'Sample Text' }
{ selector: '#btn',        prompt: 'Review this screen', skipClick: true }
{ selector: '#btn',        prompt: 'Click Add New', onConfirm: () => { /* update DOM */ } }
```

- `selector` — CSS selector for the element to highlight
- `prompt` — text shown in the floating blue tooltip
- `type` — after user clicks, auto-types this text into the input
- `skipClick: true` — shows a "Next →" button instead of waiting for a click (for observation steps)
- `onConfirm` — runs after the click, before advancing to the next step (use to update DOM state)

## Visual Style Rules

- **Tabs:** box/folder style (white active tab, gray inactive, border-bottom trick) — NOT underline style
- **Buttons:** action buttons are orange (`#f5a623` or `.btn` class), secondary/neutral are gray
- **Title underline:** blue (`border-bottom: 2px solid #3a6aaa`)
- **Header:** two-part — dark charcoal `#topbar` (30px, nav buttons) + white `#header` (88px, WISH logo)
- **Form labels:** right-aligned in a 130px column, required fields have red asterisk `<span class="req">*</span>`
- **Date fields:** include a small calendar SVG icon button (use `calBtn()` helper)
- **Time fields:** include a spinner up/down button (use `timeSpinner(id)` helper)

## The Workflow

**Before starting a session — batch your screenshots first:**
1. Log into real WISH at https://wish.schedulingsite.com
2. Navigate to every slide in the "In progress" table below
3. Screenshot each one and name it `[module]_[slide#].png` (e.g. `manage_job_5.png`)
4. Save them all to one folder

**Then in Claude Code — work through them in order:**
1. Open `mockup.html` at `localhost:8765`, navigate to the slide
2. Drag the matching screenshot into the Claude Code chat
3. Describe what needs to change — Claude edits `mockup.html` directly
4. Refresh browser, confirm match, move to next slide

Drag screenshots directly into the Claude Code chat window — Claude can read images.

**Tip:** Reporting modules (general_reporting, payroll_reporting, admin_reporting) are nearly identical — one screenshot fixes all three. Same for the workforce/employee maintenance modules.

## Module & Slide Status

**Done (accurate, do not touch):**
- manage_job slides 1, 2, 3, 4
- All slide 1s (intro cards) and slide 2s (navigation steps) across all modules

**In progress — go in this order:**

| Module | Slides to Fix |
|---|---|
| manage_job | 5 |
| mss | 3, 4, 6 |
| scheduling | 3, 4 |
| schedule_by_job_admin | 4 |
| general_reporting | 3 |
| payroll_reporting | 3 |
| admin_reporting | 3 |
| workforce_scheduler_mntnnce | 3 |
| workforce_admin_maintenance | 3 |
| employee_hr_record_maintenance | 3, 4 |
| hiring_manager | 3 |
| hiring_admin | 3 |
| mail_by | 3 |
| sign_in_sign_out | 3, 4, 5 |
| manual_process_hours | 3, 4, 5 |
| billing | 4, 5, 6, 7, 8 |

## What "Done" Means for a Slide

- Layout matches the real WISH screenshot — field positions, labels, button colors, tab names
- Gold highlight lands on the correct element each step
- Clicking it advances to the next step
- Text inputs auto-populate with realistic sample data
- Tooltip prompt text is clear and instructional

## Key Helper Functions (already in mockup.html)

```js
calBtn()          // returns SVG calendar icon button HTML — use next to date inputs
timeSpinner(id)   // returns time input + up/down spinner button HTML
```

## Slide Naming Convention

Slides are named: `slide_[module]_[number]` — e.g. `slide_manage_job_3`, `slide_mss_4`

Each slide has:
1. A `<div id="slide_...">` container in the HTML
2. A corresponding `case 'slide_...'` in `showSlide()` that calls `runGuided(steps)`

## Contact

Jesus Gonzalez — jg487377@gmail.com — ask him for WISH login credentials.
