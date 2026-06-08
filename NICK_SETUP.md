# Nick's Dev Setup — WISH Course

## Prerequisites
- Node.js 18+ installed
- PostgreSQL installed (brew install postgresql@16 on Mac, or download for Windows)

---

## One-time setup

```bash
# 1. Clone the repo
git clone https://github.com/jesus3630/wish-course
cd wish-course

# 2. Install dependencies
npm install

# 3. Create the local database
createdb wish_course

# 4. Create server/.env
```

Create a file called `.env` inside the `server/` folder with this content (ask Jesus for the real API keys):

```
PORT=3001
DATABASE_URL=postgresql://localhost/wish_course
ADMIN_PASSWORD=wish2026
ELEVENLABS_API_KEY=<ask Jesus>
ELEVENLABS_VOICE_ID=Znoc6pjc2kSb9hIuR7XU
OPENAI_API_KEY=<ask Jesus>
```

---

## Running locally

```bash
node server/index.js
```

Then open: **http://localhost:3001**

On first boot the server auto-seeds all 20 modules and quiz data from the JSON files — no manual DB setup needed.

Admin panel: **http://localhost:3001/admin** (password: `wish2026`)

---

## Editing interactive demos

The file to edit is:

```
client/public/mockup/mockup.html
```

Test a specific slide by going to:
```
http://localhost:3001/mockup/mockup.html?module=inventory&slide=4
```

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

Each slide is a function at the bottom of `mockup.html`:

```js
function slide_manage_job_3() {
  setNav('records');   // highlights the sidebar nav item
  document.getElementById('content').innerHTML = `...screen HTML...`;
  runGuided([
    { selector: '#btn-search', prompt: 'Click Search to find jobs' },
    { selector: '#btn-addnew', prompt: 'Click Add New to create a job',
      onConfirm: () => { /* runs when trainee clicks */ }},
  ]);
}
```

**Step options:**
- `selector` — CSS selector of element to highlight and wait for click
- `prompt` — instruction text shown to the trainee
- `onConfirm` — code that runs when trainee clicks (updates the screen)
- `skipClick: true` — informational step, no click required
- `type: 'some text'` — pre-fills a text input

Every function must be registered in the `routes` object at the very bottom of the file:

```js
const routes = {
  'manage_job-3': slide_manage_job_3,
  // ...
};
```

---

## After editing

1. Copy mockup to the build folder:
```bash
cp client/public/mockup/mockup.html client/build/mockup/mockup.html
```

2. Commit and push:
```bash
git add client/public/mockup/mockup.html client/build/mockup/mockup.html
git commit -m "Update interactive demo: <what you changed>"
git push
```

3. Tell Jesus to run `railway up --detach` to deploy live.
