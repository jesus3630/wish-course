# SYSTEM.md — Interactive Training Playbook

How we turn a static software screen + a voiceover script into an interactive,
click-through training demo. This is the reusable system behind the WISH course.
It is **not WISH-specific** — strip the content and the same recipe applies to any
software, any client.

Think of it like building a house: a **foundation** (the engine) poured once, a
**component library** (reusable parts) that grows, and **rooms** (modules/slides)
that go up faster the more parts exist.

---

## 1. The Big Picture

Every interactive demo is two things:

1. **A static HTML replica of the real screen** — matches the screenshot exactly
   (real fields, real dropdown options, real labels, real buttons).
2. **A guided step array** — `runGuided([...])` — describing what to highlight,
   what to say, and what happens on each click.

The demo lives in `client/public/mockup/mockup.html` (one big self-contained file:
HTML shell + CSS + one `<script>`). The React app embeds it in an iframe when a
slide has a `simulation_url`.

```
Real screenshot  ─┐
                  ├─►  static HTML replica  ─┐
Voiceover script ─┘                          ├─►  runGuided(steps)  ─►  live demo
                                             │
                          randomize real data┘
```

---

## 2. The Foundation (the engine)

### `runGuided(steps)`
The heart of every demo. Pass an array of step objects. The engine highlights the
target, shows the prompt bubble, scrolls the target into view (`block:'center'`),
and advances when the user clicks.

**Step shape:**
```js
{
  selector: '#some-id',     // element to highlight (and click, unless skipClick)
  prompt:   'What to say',  // instruction bubble text
  onConfirm: () => { ... }, // runs when the user advances past this step
  type:     'text to type', // optional: types into the selector (an input)
  also:     ['#id2','#id3'],// optional: highlight extra elements alongside selector
  skipClick: true,          // optional: highlight only; advance on prompt click (no element click required)
}
```

**Rules of thumb:**
- A step that *does* something (loads a page, checks a box, opens a modal) puts that
  logic in `onConfirm`.
- A step that just *points something out* uses `skipClick: true`.
- To highlight several things at once (e.g. "these three tabs"), use `also`.
- To demonstrate typing, use `type`.

**Completion overlay (default ON).** When the last step finishes, the engine fades in a
translucent green wash + a centered card: *"You've completed this section — Please click
Next to continue."* It's `pointer-events:none` so it never blocks. This is automatic for
every demo. To disable on a specific slide: `runGuided(steps, { completionOverlay: false })`.

### Routing
The `routes` object near the bottom of the file maps `module-slide` keys to slide
functions:
```js
const routes = {
  'workforce_admin_maintenance-4': slide_workforce_admin_maintenance_4,
  // ...
};
```
The key is `<module id>-<slide number>`. Module ids come from `course_data.json`.

### Wiring a slide to the course
A slide only shows its demo if it has a `simulation_url` in `course_data.json`:
```
/mockup/mockup.html?module=<module_id>&slide=<n>
```
On boot the server merges `simulation_url` (and a few other fields) from
`course_data.json` into the live DB — so setting it in JSON + deploying is enough.

---

## 3. The Component Library (reusable parts)

Build once, reuse everywhere. The more this grows, the cheaper each new slide.

| Part | What it gives you |
|---|---|
| `setNav(navId)` | Activates a left-nav item + expands its submenu |
| `homeScreenHTML()` | The WISH home dashboard (Unapproved Jobs / Today's Sign-In) |
| `empSearchHTML()` | The Manage Employee search page + results |
| `empRecordHTML(activeTab)` | The full real employee record (18 tabs) |
| `empRecordTabContent(tab)` | Content for each record tab — add new tabs here |
| `setEmpRecTab(name)` | Switch the active record tab + render its content |
| `calBtn()` | The little calendar-picker button icon |
| Success banner | `<div class="msg-success">` hidden until `.classList.add('show')` |
| Modal pattern | `position:fixed; inset:0` overlay + centered white box (z-index 9000+) |
| Warning/confirm pattern | Centered alert box with OK / Cancel (z-index above the modal) |
| Transfer list | Two panels + `>>` / `<<` move buttons (Shared Branches, Exclusions) |
| Scrollable table | `overflow-x:auto` wrapper + `min-width` table (Pay Rate Action column) |

**Adding a new record tab** = add one entry to `empRecordTabContent`, keyed by the
real tab name (e.g. `'Pay Rate'`, `'Exclusion'`). Every module that opens the record
gets it for free.

---

## 4. The Six-Step Build (the repeatable process)

Do this the same way for every slide. Consistency is the system.

1. **Read the script.** Pull the slide's voiceover `text` from `course_data.json`.
   It defines *what is said* and the order of ideas.
2. **Get the real screenshot.** It defines *what is shown* — exact fields, options,
   labels, buttons, layout.
3. **Replicate the screen.** Build (or reuse) the HTML to match the screenshot.
   Use real dropdown options and labels. Reuse a component if one fits.
4. **Write the guided steps.** Sequence the on-screen actions to track the narration,
   and make it *flow* (don't make the user re-navigate from scratch every slide —
   continue from where the previous slide left off when it makes sense).
5. **Randomize real data.** Replace any real employee names / numbers / emails with
   fake ones. Never ship live staff data. (Use `@maildrop.cc` style fake emails.)
6. **Ship & verify.** Sync → syntax-check → set `simulation_url` → commit both files
   → deploy → confirm live. (Commands in §6.)

---

## 5. Conventions & Guardrails

- **Match the script's scope.** If the voiceover ends at "open the record," the demo
  ends there — later tabs belong to later slides.
- **Flow between slides.** First slide of a module establishes navigation; the rest
  continue from the open record/page. Don't repeat the full lookup on every slide.
- **Keep it lean.** Highlight what the script calls out — don't narrate every field.
- **Highlight the payoff.** End Save flows by highlighting the success banner.
- **Protected functions — never delete:** `addEditJobFormHTML`, `showAddShiftModal`,
  `showAddRolePanel`. A pre-push hook blocks pushes that drop them. See top of
  `CLAUDE.md`.
- **`client/build/` MUST stay committed.** Railway runs `npm install` only — it does
  **not** run `npm run build`. The live site is served from the committed build.
  Always `cp` the public mockup to the build mockup before committing.

---

## 6. Ship It (deploy)

```bash
cd ~/Projects/wish-course

# 1. sync the edited mockup into the committed build copy
cp client/public/mockup/mockup.html client/build/mockup/mockup.html

# 2. syntax-check the script block
node -e "const fs=require('fs');const h=fs.readFileSync('client/public/mockup/mockup.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);fs.writeFileSync('/tmp/m.js',m[1]);"
node --check /tmp/m.js && echo "JS OK"

# 3. (if a new/changed sim) set simulation_url in course_data.json for the slide

# 4. commit BOTH mockup files (+ course_data.json if changed)
git add client/public/mockup/mockup.html client/build/mockup/mockup.html course_data.json
git commit -m "Module X slide N: <what it does>"
git push origin main

# 5. deploy
railway service link wish-app
railway up --detach

# 6. verify live
curl -s -o /dev/null -w '%{http_code}' https://wish-training.up.railway.app/
curl -s https://wish-training.up.railway.app/mockup/mockup.html | grep -c '<some marker from your change>'
```

A pre-commit hook auto-copies public → build if you forget step 1. `./deploy.sh`
wraps the whole thing.

---

## 7. Why This Is a Reusable Concept

- **Screen-agnostic.** Any screen = static replica + step array. The engine doesn't
  care if it's payroll, reporting, or HR. (Proven: Modules 7/8 were built on the same
  engine independently of Modules 10–12.)
- **Marginal cost falls.** The component library compounds; later modules mostly
  assemble existing parts.
- **Portable.** Remove the WISH content and you have a generic playbook for turning
  any software training into an interactive, screenshot-accurate walkthrough.

The deliverable at the end is two things: the finished WISH course, **and** this
system — engine + component library + the six-step build — ready to point at the
next piece of software.
