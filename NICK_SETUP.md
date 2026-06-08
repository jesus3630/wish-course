# Nick's Dev Setup — WISH Interactive Demos

## One-time setup

```bash
# 1. Clone the repo
git clone https://github.com/jesus3630/wish-course
cd wish-course
```

That's it. No npm install needed for editing demos.

---

## The file you edit

```
client/public/mockup/mockup.html
```

This is a single self-contained HTML file. Open it directly in Chrome to test:

```
file:///path/to/wish-course/client/public/mockup/mockup.html?module=inventory&slide=4
```

Replace `inventory` and `4` with whichever module/slide you're working on.

**Module IDs:**
| Module | ID |
|---|---|
| Introduction | `introduction` |
| Record Maintenance | `record_maintenance` |
| Manage Job | `manage_job` |
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
| Hiring Admin | `hiring_admin` |
| Mail By | `mail_by` |
| Sign-In / Sign-Out | `sign_in_sign_out` |
| Manual Process Hours | `manual_process_hours` |
| Billing | `billing` |
| Inventory | `inventory` |
| MSS | `mss` |

---

## How demos are structured

Each slide has a function at the bottom of mockup.html:

```js
function slide_manage_job_3() {
  setNav('records');                              // highlights sidebar nav
  document.getElementById('content').innerHTML = `...HTML for the screen...`;
  runGuided([
    { selector: '#btn-search', prompt: 'Click Search to find jobs' },
    { selector: '#btn-addnew', prompt: 'Click Add New to create a job',
      onConfirm: () => { /* code that runs when user clicks */ }},
  ]);
}
```

**Step options:**
- `selector` — CSS selector of the element to highlight
- `prompt` — instruction shown to the trainee
- `onConfirm` — code that runs when the trainee clicks (updates the UI)
- `skipClick: true` — show the prompt but don't wait for a click (informational step)
- `type: 'some text'` — pre-fills a text field

And it must be registered in the `routes` object at the very bottom:

```js
const routes = {
  ...
  'manage_job-3': slide_manage_job_3,
  ...
};
```

---

## After editing

1. Copy to the build folder:
   ```bash
   cp client/public/mockup/mockup.html client/build/mockup/mockup.html
   ```

2. Commit and push:
   ```bash
   git add client/public/mockup/mockup.html client/build/mockup/mockup.html
   git commit -m "Update interactive demo: <module name>"
   git push
   ```

3. Tell Jesus to deploy:
   ```bash
   railway up --detach
   ```
   (Jesus runs this from his Mac — Nick doesn't need Railway CLI)

---

## Testing a specific slide

Open in browser with URL params:
```
mockup.html?module=billing&slide=5
mockup.html?module=payroll_processing&slide=6
```

If the slide isn't in the routes table yet, you'll see:
```
Unknown slide: billing-5
```
That means you need to add the function + route.
