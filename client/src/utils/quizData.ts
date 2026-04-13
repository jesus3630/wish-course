import { QuizQuestion } from '../types';

// Auto-generated quiz questions per module
// Replace with API-generated questions once Anthropic key is added

const quizData: Record<string, QuizQuestion[]> = {
  introduction: [
    {
      id: 'intro_1',
      question: 'What does WISH stand for?',
      options: [
        'Workforce Information Systems Hosted',
        'Workforce Integration Services Hub',
        'Web-based Information Scheduling Hub',
        'Workforce Intelligence Systems Hosted',
      ],
      correct_index: 0,
      explanation: 'WISH stands for Workforce Information Systems Hosted — an all-in-one workforce application supporting the entire employee lifecycle.',
    },
    {
      id: 'intro_2',
      question: 'Where can you access WISH?',
      options: [
        'Only from the office network',
        'Through the ESS mobile app only',
        'Online at wish.schedulingsite.com',
        'By downloading a desktop application',
      ],
      correct_index: 2,
      explanation: 'WISH is available online at wish.schedulingsite.com and can be accessed from any location with an internet connection.',
    },
    {
      id: 'intro_3',
      question: 'What happens if you attempt to access a menu without the required training?',
      options: [
        'You are automatically enrolled in the training',
        'Access is granted with a warning',
        'Access is restricted with a message',
        'Your account is locked',
      ],
      correct_index: 2,
      explanation: 'If you attempt to open a menu for which you have not completed the required training, access will be restricted with a message.',
    },
    {
      id: 'intro_4',
      question: 'What is a Broadcast Message in WISH?',
      options: [
        'An email sent to your personal inbox',
        'A two-way communication system',
        'A one-way system notification about updates or changes',
        'A chat feature between employees',
      ],
      correct_index: 2,
      explanation: 'Broadcast Messages are one-way communications that cannot be replied to. They inform users of system changes, new features, or scheduled downtime.',
    },
    {
      id: 'intro_5',
      question: 'Why should you NOT share your WISH login credentials?',
      options: [
        'It violates your employment contract only',
        'All actions performed under your credentials are recorded as yours',
        'It slows down the system for other users',
        'Shared logins expire faster',
      ],
      correct_index: 1,
      explanation: 'All actions performed using your credentials will be recorded in the system as being completed by you, making credential sharing a serious accountability issue.',
    },
  ],

  record_maintenance: [
    {
      id: 'rec_1',
      question: 'What is the primary purpose of the Records menu?',
      options: [
        'To schedule employees to jobs',
        'To generate client invoices',
        'To enter, edit, and update essential data',
        'To process payroll',
      ],
      correct_index: 2,
      explanation: 'The Records menu is where you will spend much of your time entering, editing, and updating essential data vital for branch operations.',
    },
    {
      id: 'rec_2',
      question: 'Which of the following can be managed under Record Maintenance?',
      options: [
        'Payroll processing only',
        'Clients, Contracts, Events, and Venues',
        'Employee self-scheduling',
        'Time clock configuration',
      ],
      correct_index: 1,
      explanation: 'Record Maintenance provides the ability to manage Jobs, Clients, Contracts, Events, and Venues.',
    },
    {
      id: 'rec_3',
      question: 'Why is maintaining accurate records critical?',
      options: [
        'It is only required for billing purposes',
        'It affects employee self-service access',
        'Accurate records are vital for branch operations',
        'It determines payroll tax rates',
      ],
      correct_index: 2,
      explanation: 'Maintaining accurate records is vital for your branch\'s operations across all functions of WISH.',
    },
  ],

  manage_job: [
    {
      id: 'job_1',
      question: 'What is the Manage Job permission designed for?',
      options: [
        'Full record access including clients and venues',
        'Creating and modifying jobs only',
        'Scheduling employees to events',
        'Billing clients after jobs',
      ],
      correct_index: 1,
      explanation: 'Manage Job provides the ability to create and modify jobs only. If Record Maintenance is selected, Manage Job should not also be selected.',
    },
    {
      id: 'job_2',
      question: 'What is the correct way to create a new job in WISH?',
      options: [
        'Go to Scheduling → Add New Job',
        'Go to Admin → Create Job',
        'Go to Records → Manage Job, then use the filter page and create a new job',
        'Go to Billing → New Job Entry',
      ],
      correct_index: 2,
      explanation: 'To create a new job, go to Records → Manage Job. Use the filter page to search for existing jobs or create a new one from there.',
    },
  ],

  mss: [
    {
      id: 'mss_1',
      question: 'What does MSS allow in WISH?',
      options: [
        'Manager self-scheduling',
        'Publishing jobs to the web for Employee Self Service (ESS)',
        'Mobile sign-in for employees',
        'Mass schedule updates',
      ],
      correct_index: 1,
      explanation: 'MSS provides access to publish jobs to the web for ESS (Employee Self Service), allowing employees to view and request shifts.',
    },
  ],

  scheduling: [
    {
      id: 'sched_1',
      question: 'What are the two ways the scheduling department can schedule employees?',
      options: [
        'By date and by location',
        'By employee and by job',
        'By manager and by department',
        'By pay rate and by seniority',
      ],
      correct_index: 1,
      explanation: 'The scheduling department schedules employees in one of two ways: Schedule by Employee or Schedule by Job.',
    },
    {
      id: 'sched_2',
      question: 'How is self-scheduling done by employees different from scheduler scheduling?',
      options: [
        'Employees use the WISH desktop app',
        'Employees self-schedule through their ESS app',
        'Employees submit paper requests',
        'Employees use a separate scheduling email',
      ],
      correct_index: 1,
      explanation: 'Employees can self-schedule through their ESS (Employee Self Service) app, which is separate from what the scheduling department does in WISH.',
    },
  ],

  schedule_by_job_admin: [
    {
      id: 'sjadmin_1',
      question: 'What additional capability does the Schedule By Job Admin permission provide?',
      options: [
        'Access to payroll reports',
        'Ability to double and overlap schedules',
        'Permission to create new jobs',
        'Access to billing functions',
      ],
      correct_index: 1,
      explanation: 'Schedule By Job Admin provides the ability to double and overlap schedules, which is an elevated scheduling permission.',
    },
  ],

  general_reporting: [
    {
      id: 'gen_rep_1',
      question: 'What level of reporting access does General Reporting provide?',
      options: [
        'Full access to all reports including payroll',
        'Payroll and billing reports only',
        'Basic reporting access',
        'Administrative reports only',
      ],
      correct_index: 2,
      explanation: 'General Reporting provides basic reporting access, which is the entry level of reporting permissions in WISH.',
    },
    {
      id: 'gen_rep_2',
      question: 'Which report would help a job administrator manage an event?',
      options: [
        'Payroll processing report',
        'Alpha roster and sign-in/sign-out sheets',
        'Billing invoice report',
        'Employee disciplinary report',
      ],
      correct_index: 1,
      explanation: 'The Reports menu provides access to alpha rosters and sign-in/sign-out sheets for events, which support job administration.',
    },
  ],

  payroll_reporting: [
    {
      id: 'pay_rep_1',
      question: 'What does the Payroll Reporting permission grant access to?',
      options: [
        'Processing payroll checks',
        'Access to Payroll Reports',
        'Approving employee timesheets',
        'Setting employee pay rates',
      ],
      correct_index: 1,
      explanation: 'Payroll Reporting grants access to Payroll Reports, which is a specific permission level above General Reporting.',
    },
  ],

  admin_reporting: [
    {
      id: 'adm_rep_1',
      question: 'What reports are accessible under Admin Reporting?',
      options: [
        'General reports only',
        'Payroll reports only',
        'Manager, Billing, and Payroll Reports',
        'HR and disciplinary reports only',
      ],
      correct_index: 2,
      explanation: 'Admin Reporting provides the highest reporting access, including Manager, Billing, and Payroll Reports.',
    },
  ],

  workforce_scheduler_mntnnce: [
    {
      id: 'ws_mnt_1',
      question: 'What can a user with Workforce Scheduler Maintenance access do?',
      options: [
        'Edit employee pay rates',
        'View employee records, licensing, BG checks, and employee notes',
        'Approve payroll',
        'Create new user accounts',
      ],
      correct_index: 1,
      explanation: 'Workforce Scheduler Maintenance allows viewing employee record information and updating Licensing, Background checks, and Employee Notes.',
    },
  ],

  workforce_admin_maintenance: [
    {
      id: 'wa_mnt_1',
      question: 'What additional access does Workforce Admin Maintenance provide over Scheduler Maintenance?',
      options: [
        'Access to billing functions',
        'Ability to view and edit Disciplinary Action, Pay Rates, and Training information',
        'Permission to create schedules',
        'Access to MSS publishing',
      ],
      correct_index: 1,
      explanation: 'Workforce Admin Maintenance provides the ability to view and edit Disciplinary Action, Pay Rates, and Training information — elevated over Scheduler Maintenance.',
    },
  ],

  employee_hr_record_maintenance: [
    {
      id: 'hr_1',
      question: 'Which of the following can be managed under Employee HR Record Maintenance?',
      options: [
        'Client contracts and venues',
        'Employee status, email, phone, disciplinary action, and pay rates',
        'Job scheduling and event management',
        'Billing and invoice generation',
      ],
      correct_index: 1,
      explanation: 'Employee HR Record Maintenance allows managing employee records including status changes, contact info, disciplinary action, pay rates, and background checks.',
    },
    {
      id: 'hr_2',
      question: 'What does "shared branches" refer to in employee record management?',
      options: [
        'Sharing billing across multiple clients',
        'Employees who work across multiple branch locations',
        'Branch-level reporting access',
        'Shared login credentials between branches',
      ],
      correct_index: 1,
      explanation: 'Shared branches refers to managing employees who work across multiple branch locations within the WISH system.',
    },
  ],

  hiring_manager: [
    {
      id: 'hire_mgr_1',
      question: 'What tool does the Hiring Manager permission provide access to?',
      options: [
        'The payroll import tool',
        'The Import from Hportal tool',
        'The scheduling export tool',
        'The billing import tool',
      ],
      correct_index: 1,
      explanation: 'The Hiring Manager permission provides access to the Import from Hportal tool for bringing new hire information into WISH.',
    },
  ],

  hiring_admin: [
    {
      id: 'hire_adm_1',
      question: 'What page does the Hiring Admin permission grant access to?',
      options: [
        'The Payroll Management page',
        'The Manage Employee Task page',
        'The Schedule Administration page',
        'The Billing Management page',
      ],
      correct_index: 1,
      explanation: 'Hiring Admin provides access to the Manage Employee Task page for HR administrative functions.',
    },
  ],

  mail_by: [
    {
      id: 'mail_1',
      question: 'What does the Mail By permission include?',
      options: [
        'Sending external emails to clients',
        'Both Mail by Employee and Mail by Job',
        'Broadcast message creation',
        'Employee notification settings',
      ],
      correct_index: 1,
      explanation: 'The Mail By permission includes both Mail by Employee and Mail by Job capabilities.',
    },
  ],

  'sign-in__sign-out': [
    {
      id: 'signin_1',
      question: 'What does the Sign-In/Sign-Out permission include?',
      options: [
        'Employee login management only',
        'Both Sign-In Configuration and Sign-Out Configuration',
        'Time clock hardware setup',
        'Payroll approval for signed-in employees',
      ],
      correct_index: 1,
      explanation: 'The Sign-In/Sign-Out permission includes both Sign-In Configuration and Sign-Out Configuration.',
    },
    {
      id: 'signin_2',
      question: 'What is the Time Clock menu used for?',
      options: [
        'Scheduling employees for future shifts',
        'Billing clients for completed events',
        'Employees signing in and out at event locations',
        'Payroll approval by managers',
      ],
      correct_index: 2,
      explanation: 'The Time Clock menu is used at event locations where computers allow employees to sign in at the start of shifts and sign out at the end.',
    },
  ],

  manual_process_hours: [
    {
      id: 'mph_1',
      question: 'Where is Manual Process Hours managed in WISH?',
      options: [
        'Under the Scheduling menu',
        'Under the Records menu',
        'In the Payroll menu — Manage Process Hours',
        'Under the Admin menu',
      ],
      correct_index: 2,
      explanation: 'Manual Process Hours access is located in the Payroll section under Manage Process Hours.',
    },
    {
      id: 'mph_2',
      question: 'What is the Payroll menu used for?',
      options: [
        'Scheduling employees to future events',
        'Reviewing and approving employee work hours after an event',
        'Generating client invoices',
        'Creating new employee records',
      ],
      correct_index: 1,
      explanation: 'The Payroll menu is where payroll staff review and approve employees\' work hours after an event to ensure proper compensation.',
    },
  ],

  billing: [
    {
      id: 'bill_1',
      question: 'When can you generate an invoice for a client using the Billing menu?',
      options: [
        'Before the event is scheduled',
        'After your branch has completed a job',
        'Only at the end of the fiscal quarter',
        'When the employee timesheets are submitted',
      ],
      correct_index: 1,
      explanation: 'The Billing menu allows you to generate invoices for clients after your branch has completed a job.',
    },
    {
      id: 'bill_2',
      question: 'What happens to a schedule when it is saved in WISH?',
      options: [
        'It is automatically emailed to the client',
        'It is deleted after the event',
        'It is stored in the system for future billing purposes',
        'It requires manager approval before saving',
      ],
      correct_index: 2,
      explanation: 'Whenever a schedule is saved in the system, it is stored for future billing purposes to ensure accurate client invoicing.',
    },
    {
      id: 'bill_3',
      question: 'Which of the following is a billing function in WISH?',
      options: [
        'Scheduling employees to jobs',
        'Check Bill for Job, Manage Billing Process, and view/print invoice',
        'Approving employee pay rates',
        'Managing employee training records',
      ],
      correct_index: 1,
      explanation: 'Billing functions include: Check Bill for Job, Manage Billing Process, and the ability to view/print invoices for clients.',
    },
  ],
};

export default quizData;
