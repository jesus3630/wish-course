# WISH Interactive Training — Design Brief

**For:** Claude Design feature
**From:** ProtaTECH (WISH e-learning course)
**Goal:** Reimagine our interactive, click-through software-training demos. Take the
reference demo we built (`wish-reference-demo.html`, in this folder — open it in a
browser, it runs standalone) and see if you can do it **better**: better visual design,
better interaction feel, better learner guidance — while keeping it a screenshot-accurate
walkthrough of real software.

---

## 1. What this is

We turn a **static replica of a real software screen** + a **voiceover script** into an
**interactive, guided click-through**. The learner reads/hears the narration, then is
guided to click the exact buttons and fields in a pixel-accurate replica of the live app.

It's an e-learning course for **WISH** (Workforce Information Systems Hosted), ProtaTECH's
all-in-one workforce platform (hiring → scheduling → timesheets → payroll → billing) used
by Los Angeles County staff. 19 modules; the "Introduction" module is the one to design
against here.

Every interactive demo is exactly two parts:
1. **A static HTML replica of the real screen** — real fields, real dropdown options, real
   labels, real buttons, matching the actual software screenshot.
2. **A guided step array** — `runGuided([...])` — describing what to highlight, what to
   say, and what happens on each click.

```
Real screenshot  ─┐
                  ├─►  static HTML replica  ─┐
Voiceover script ─┘                          ├─►  runGuided(steps)  ─►  live demo
                                             │
                          fake/randomized data┘  (never ship real staff data)
```

---

## 2. The engine API (what drives every demo)

`runGuided(steps)` highlights a target, shows a prompt bubble + bouncing arrow, scrolls the
target into view, and advances when the learner clicks it. Step shape:

```js
{
  selector:  '#some-id',     // element to highlight (and click, unless skipClick)
  prompt:    'What to say',  // instruction bubble text (tracks the narration)
  onConfirm: () => { ... },  // runs when the learner advances past this step (load a page, open a modal, check a box)
  type:      'text to type', // optional: animate-types into the selector input
  also:      ['#id2','#id3'],// optional: highlight several elements at once ("these three tabs")
  skipClick: true,           // optional: highlight only; advance via a Next button (no element click needed)
}
```

- A step that **does** something → put it in `onConfirm`.
- A step that just **points something out** → `skipClick: true`.
- Completion overlay fades in automatically on the last step ("You've completed this section").
- Bottom bar shows **STEP n / N** with progress pips.

This is all vanilla HTML/CSS/JS in one self-contained file — no framework, no build. The React
course app embeds it in an iframe at 1280×720 when a slide has a `simulation_url`.

---

## 3. Visual system (current — feel free to elevate)

| Token | Value |
|---|---|
| Brand orange (buttons, logo, highlight arrow) | `#e07820` / `#e07b00`, hover `#c86000`, arrow `#ff8c00` |
| Deep navy (prompt bubble, progress bar, header chip) | `#1a3c5a` |
| Link / accent blue | `#3a6aaa` |
| Success green (completion, "New" badge) | `#4caf50` |
| App canvas grey | `#d0cfc9`; card white `#fff`, border `#ccc` |
| Table header | `#5a5a5a` on white text |
| Font | Arial/Helvetica, 12–13px body |
| WISH wordmark | bold italic, orange, tagline *"your blueprint to success"* |
| Frame size | 1280×720 (fixed; iframe-embedded) |
| Guided highlight | 5px orange outline + pulsing box-shadow + bouncing "👆 Click here" / "👀 Look here" label |

The chrome is intentionally a faithful replica of the real (slightly dated, enterprise-ASP.NET)
WISH UI: top bar, white logo header, left icon nav (Admin / Billing / Inventory / Records /
Reports / Scheduling / Payroll / Time Clock / Tools / Home), main content card, footer.

---

## 4. The "Introduction" module storyboard (design against this)

16–17 short lessons. Voiceover text + what each shows:

1. **Getting Started** — Welcome to WISH (Workforce Information Systems Hosted) by ProtaTECH; supports the full employee lifecycle in one integrated system.
2. **WISH URL** — "WISH is available online at wish.schedulingsite.com." *(This is the slide the reference demo implements: type the URL → press Go → the real login page loads.)*
3. **Getting Started / Login** — You need login credentials (sent to your ESS email after training). Accept the cookies & privacy policy before first login.
4. **ESS Employee Portal** — ess.schedulingsite.com; where your WISH credentials are sent.
5. **Do Not Share Your Login Credentials** — Every action is recorded as you ("Order Taken By" stamps your name). Access is gated by completed training.
6. **Broadcast Messages** — Envelope icon by your name → one-way system announcements.
7. **Change Password** — Your name (top-right) → My Messages / Log Out / Change Password.
8. **W.I.S.H. acronym** — Workforce Information Systems Hosted; modules (Scheduling, Billing, HR, Payroll) consolidated into one web platform.
9. **WISH Menus** — Tour of the left-nav application menus.
10. **Admin Menu** — Restricted to developers; access-denied message if you lack permission.
11+ — the remaining left-nav menus (Billing, Inventory, Records, Reports, Scheduling, Payroll, etc.), each introduced briefly.

The narration is warm, plain-English, ~1–4 sentences per slide.

---

## 5. What "better" could mean (your brief)

Keep it **screenshot-accurate** and **guided** — that's the product. Within that, push on:

- **Visual polish** — a more modern, cohesive course-player shell around the (deliberately
  legacy) app replica: header with module title + progress, sidebar lesson list/TOC, a clean
  lesson stage, Next/Back nav, module-complete state.
- **Interaction feel** — smoother highlight/arrow/typing animations, better focus management,
  a more satisfying "step complete → next" rhythm, optional keyboard nav.
- **Guidance clarity** — clearer step prompts, better spotlight/dimming of the rest of the
  screen, progress legibility.
- **Media slots** — drag-and-drop slots so a producer can drop a screen recording or
  screenshot into each lesson (some lessons are video, some are interactive replicas).
- **Reusability** — the engine is meant to be **software-agnostic**: strip the WISH content
  and the same recipe should retrain on any enterprise app.

Deliverable we'd love to see: a polished single-module **course player** (the Introduction
module) wrapping interactive lessons built on a guided-step engine like ours — and a take on
whether the engine/component model itself can be cleaner.

---

## 6. Files in this handoff

- `wish-reference-demo.html` — **standalone, runnable.** One real lesson ("WISH URL"): type
  the address → Go → the real WISH login page animates in, with the full guided engine
  (arrow, prompt bubble, step pips, completion overlay). This is the bar to beat.
- `WISH-INTERACTIVE-BRIEF.md` — this file.
