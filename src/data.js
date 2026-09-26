// All site content lives here. Edit freely — the game reads everything from this file.

export const PROFILE = {
  name: 'Uday Kiran Bokka',
  short: 'Uday',
  role: 'Technical Product Manager',
  company: 'ICICI Bank',
  location: 'Mumbai, Maharashtra',
  hometown: 'Hyderabad, Telangana',
  email: 'udaykiranbokka00@gmail.com',
  linkedin: 'https://www.linkedin.com/in/bokka-uday-kiran-a8082a250/',
  phone: null, // e.g. '+91-XXXXXXXXXX' — left out of the public site by default
  tagline: 'I turn banking, compliance & HR problems into products people use every day.',
  industries: ['Fintech', 'Payments', 'Banking', 'HR-tech'],
};

// Payment status stepper (maps onto career arc)
export const STATUSES = ['Initiated', 'KYC Verified', 'Authorized', 'Processing', 'Settled'];

// Skill coins that can be collected on the rails between nodes (index = node you are heading to)
export const SKILL_POOL = [
  ['Curiosity', 'Photography', 'Cricket', 'Coding'],
  ['DSA', 'OOP', 'Python', 'JavaScript', 'SQL', 'Leadership'],
  ['React', 'Node.js', 'Spring Boot', 'MySQL', 'Rails', 'PostgreSQL', 'MongoDB', 'Testing'],
  ['Product Ownership', 'Stakeholders', 'Banking Ops', '.NET', 'MS SQL'],
  ['Power BI', 'Data Modelling', 'API Integration', 'Alerting', 'Monitoring'],
  ['Web APIs', 'Compliance', 'RBI Guidelines', 'Notifications', 'Prod Support'],
  ['REST APIs', 'Master Data', 'Consumers', 'Dashboards', 'Networking'],
  ['Audit Trails', 'Workflows', 'Escalations', 'Governance', 'Reviews'],
  ['.NET Core', 'Payroll', 'Onboarding', 'Security', 'Integrations'],
  ['Scrum', 'Retros', 'Roadmaps', 'Timelines', 'Claude', 'ChatGPT'],
  ['Delivery', 'Ownership', 'Communication'],
];

export const OBSTACLES = ['SCOPE CREEP', 'PROD BUG', 'BLOCKER', 'MISSED SLA', 'VAGUE REQ', 'FRAUD FLAG'];

/*
  Node schema
  id, code, status (index into STATUSES), short (route bar), title, subtitle, meta (chips of facts),
  intro, sections [{ heading, items[] }], tags[], stats[{k,v}], links[{label,url}], widget ('refresh'|'escalation'|'onboarding'|null)
  landmark: builder key in world/landmarks.js, side: -1 left / 1 right
*/
export const NODES = [
  {
    id: 'hyd', code: 'NODE 00 · ORIGIN', status: 0, short: 'HYD', landmark: 'charminar', side: 1,
    title: 'Hyderabad, Telangana',
    subtitle: 'Transaction initiated. Payer: Uday Kiran Bokka',
    meta: ['Hometown · Hyderabad', 'Now · Mumbai', 'TPM @ ICICI Bank', 'IIT Dharwad CSE ’23'],
    intro: 'Hi, I’m Uday. I’m a Technical Product Manager at ICICI Bank: part business analyst, part product manager, fully accountable. I own internal banking products end to end, from the first requirement call to the production fix at 9 AM. This site works like a payment: you’re the rail, my career is the route. Let’s settle it.',
    sections: [
      { heading: 'How to play', items: [
        '← / → or A / D (swipe on phone) to switch lanes',
        'Hold Space / ↑ (or ⚡) to boost',
        'Collect skill coins, dodge Scope Creep & Prod Bugs',
        'Tap any station on the route bar to fast-travel',
        'Press P for Passbook mode, the plain-text résumé',
      ] },
    ],
    tags: ['Photography', 'Cricket', 'Coding', 'Dance'],
  },
  {
    id: 'iit', code: 'NODE 01 · KYC VERIFIED', status: 1, short: 'IIT DH', landmark: 'campus', side: -1,
    title: 'IIT Dharwad',
    subtitle: 'B.Tech, Computer Science & Engineering',
    meta: ['2019 – 2023', 'Dharwad, Karnataka'],
    intro: 'Four years of CS fundamentals, DSA and building things, plus a lot of running things: hostels, clubs and recruiter outreach.',
    sections: [
      { heading: 'Positions of responsibility', items: [
        'Hostel Secretary (2nd year): represented residents and ran hostel affairs',
        'Secretary, Photography & Films Club (2021–22): ran competitions and was lead photographer for PARSEC, IIT Dharwad’s tech fest',
        'PR Coordinator, Career Development Cell (Nov 2020 – May 2021): contacted HRs and brought in new recruiters for internships & placements',
        'SMP Student Mentor: guided and mentored freshers',
      ] },
      { heading: 'Beyond the classroom', items: [
        'Group Dance at the Inter IIT Cultural Meet 5.0, IIT Madras (2023)',
        'Core member of the Dance Club and the Cricket Club',
        'Certifications: Problem Solving, SQL, Python, Web Development Bootcamp',
      ] },
    ],
    tags: ['DSA', 'OOP', 'Python', 'JavaScript', 'SQL'],
  },
  {
    id: 'dev', code: 'NODE 02 · AUTHORIZED', status: 2, short: 'BUILD', landmark: 'chat', side: 1,
    title: 'The Builder Years',
    subtitle: 'Internships & first dev role, 2021 – 2023',
    meta: ['Bengaluru', 'Mumbai', 'New Delhi (NCR)'],
    intro: 'Before owning products I built them. That’s why I can read an API contract, estimate honestly and talk to engineers in their own language.',
    sections: [
      { heading: 'Jarvis Technology & Strategy Consulting · Software Developer · Jun – Jul 2023', items: [
        'Built interactive front-end components in React, HTML, CSS and JavaScript',
        'Back-end work in Ruby on Rails with PostgreSQL for data storage and retrieval',
      ] },
      { heading: 'Gupshup · Software Developer Intern · May – Nov 2022 · Mumbai', items: [
        'Journey Builder (chatbot journey platform): worked on string localization',
        'Tested Journey Builder components with React Testing Library',
        'WhatsApp Scheduler: an API that schedules WhatsApp messages for a set time via the WhatsApp Business API (Spring Boot, MySQL, JUnit)',
      ] },
      { heading: 'Verzeo · Software Developer Intern · May – Jun 2021 · Bengaluru', items: [
        'Completed minor and major projects under mentor guidance, with a focus on web performance and scalability',
      ] },
    ],
    links: [
      { label: 'MERN Todo App (live)', url: 'https://awesometodouday-app.onrender.com/' },
      { label: 'Geolocation Weather App (live)', url: 'https://geolocation-weather-app.vercel.app/' },
    ],
    tags: ['React', 'Node.js', 'Spring Boot', 'Rails', 'PostgreSQL', 'MySQL', 'MongoDB'],
  },
  {
    id: 'icici', code: 'NODE 03 · PROCESSING', status: 3, short: 'ICICI', landmark: 'tower', side: -1,
    title: 'ICICI Bank',
    subtitle: 'Technical Product Manager',
    meta: ['26 Jun 2024 – Present', 'Mumbai', 'Fintech · Banking · HR'],
    intro: 'A hybrid of Business Analyst and Product Manager with full ownership of internal banking platforms. I gather and shape requirements, check feasibility, set timelines, get delivery done through the dev team and own what happens in production afterwards.',
    stats: [
      { k: '5', v: 'product lines owned' },
      { k: 'E2E', v: 'requirements → prod' },
      { k: 'Agile', v: 'Scrum, sprints, retros' },
    ],
    sections: [
      { heading: 'What ownership means here', items: [
        'Requirement gathering with business, HR, compliance and ops stakeholders',
        'Feasibility checks with developers before anything is committed',
        'Timelines, delivery tracking and progress communication',
        'Live issue resolution, monitoring and continuous upgrades of legacy .NET systems',
      ] },
    ],
    tags: ['.NET', '.NET Core', 'Web APIs', 'MS SQL Server', 'Power BI', 'Agile'],
  },
  {
    id: 'dash', code: 'NODE 04 · PRODUCT', status: 3, short: 'DASH', landmark: 'bars', side: 1,
    title: 'Corporates & Reports Dashboard',
    subtitle: 'Power BI dashboards HR runs on every day',
    meta: ['Power BI', 'Microservice APIs', 'Alerting'],
    intro: 'HR teams use this dashboard daily for monitoring and analytics. The hard part isn’t the charts, it’s the data: several teams own it, behind several services.',
    sections: [
      { heading: 'How it works', items: [
        'Different teams expose API endpoints that give us a copy of their data',
        'We combine, link and structure that data into one model, then build the dashboards on top',
        'Dashboard refresh time brought down to a minimum',
      ] },
      { heading: 'My role', items: [
        'New requirement → check the data → gather needs → talk to devs → check feasibility → ship',
        'Scheduled refreshes with alerting: any failure fires Email and MS Teams notifications through configured notification services',
        'Continuous monitoring for errors and data issues',
      ] },
    ],
    widget: 'refresh',
    tags: ['Power BI', 'Data Modelling', 'API Integration', 'Alerting'],
  },
  {
    id: 'circ', code: 'NODE 05 · PRODUCT', status: 3, short: 'E-CIRC', landmark: 'circulars', side: -1,
    title: 'E-Circulars',
    subtitle: 'One bank-wide portal for every circular',
    meta: ['3 modules', 'Legacy .NET + Web APIs', 'Regulatory'],
    intro: 'Teams across the bank publish their circulars on this portal, and anyone can find and read any circular in one place.',
    sections: [
      { heading: 'What I own', items: [
        'Three modules used by publishing teams across the bank',
        'Compliance management, including RBI requirements and notices',
        'Scheduled notifications so the right people see the right circular',
        'Live issue resolution, monitoring and new requirements end to end',
      ] },
    ],
    tags: ['.NET', 'Web APIs', 'Compliance', 'Notifications'],
  },
  {
    id: 'branch', code: 'NODE 06 · PRODUCT', status: 3, short: 'BRANCH', landmark: 'network', side: 1,
    title: 'Branch Network',
    subtitle: 'The bank’s A-to-Z source of truth on branches, served as APIs',
    meta: ['Master data', 'Bank-wide API', 'Dashboard'],
    intro: 'Every ICICI branch in one place: start dates, employee details, cash flow, liquid cash, ATMs, location, management and more.',
    sections: [
      { heading: 'Why it matters', items: [
        'Exposed as APIs that systems across the bank consume',
        'We maintain, update and refresh those APIs so every consumer sees current data',
        'A dashboard on top for a visual view of the network',
      ] },
      { heading: 'My role', items: [
        'Stakeholder networking with the consuming teams',
        'Requirement gathering and change management for API consumers',
      ] },
    ],
    tags: ['REST APIs', 'Master Data', 'MS SQL', 'Dashboards'],
  },
  {
    id: 'comp', code: 'NODE 07 · PRODUCT', status: 3, short: 'COMPLY', landmark: 'ziggurat', side: -1,
    title: 'Compliance Certificates',
    subtitle: 'Monthly branch compliance, multi-level review',
    meta: ['Monthly cycle', 'Quarterly tracking', 'COMP1 → COMP4'],
    intro: 'In the first 2–3 working days of every month, branch managers and deputy managers submit a compliance questionnaire: is the branch following every rule? It’s effectively a continuous audit.',
    sections: [
      { heading: 'The workflow', items: [
        'Questionnaire submission by branch and deputy managers',
        'Deviations are tracked and escalated through review levels, up to the Regional Head and then the Zonal Head',
        'Quarterly tracking with a full history of submissions and deviations',
      ] },
    ],
    widget: 'escalation',
    tags: ['Audit', 'Workflow', 'Governance', 'Escalations'],
  },
  {
    id: 'hr4u', code: 'NODE 08 · PRODUCT', status: 3, short: 'HR4U', landmark: 'idcard', side: 1,
    title: 'HR4U',
    subtitle: 'HR self-service + Payroll, in two stages',
    meta: ['.NET + .NET Core', 'MS SQL', 'APIs for other teams'],
    intro: 'My most recent product: one place for employees to handle HR and pay, from their first day onwards.',
    sections: [
      { heading: 'Stage 1 · HR', items: [
        'New-joiner onboarding: submit declarations and nominations, then activate the salary account',
        'HR portals for day-to-day tasks (Workday-style): submit and update your data',
      ] },
      { heading: 'Stage 2 · Payroll', items: [
        'Full financial view: payslips, compensation, tax info and percentages, gratuity, PF',
        'Payroll data exposed as APIs for other teams',
        'Security-first design on .NET / .NET Core and MS SQL, delivered in Agile sprints',
      ] },
    ],
    widget: 'onboarding',
    tags: ['.NET Core', 'MS SQL', 'Payroll', 'Security', 'APIs'],
  },
  {
    id: 'agile', code: 'NODE 09 · PLAYBOOK', status: 3, short: 'AGILE', landmark: 'loop', side: -1,
    title: 'How I Run a Team',
    subtitle: 'Agile, deadlines and team spirit',
    meta: ['Scrum Master duties', 'TPM', 'AI-assisted'],
    intro: 'Products ship because the team shows up together. I run the rituals, hold the deadlines and keep everyone informed.',
    sections: [
      { heading: 'Rituals I own', items: [
        'Daily scrum calls and sprint cadence',
        'Strict deadline management and clear progress communication to stakeholders',
        'Retros that actually change things, plus team activities that keep morale high',
      ] },
      { heading: 'Toolkit', items: [
        'Hands-on with AI tools (Claude, ChatGPT) to speed up analysis, documentation and prototyping',
        'Strong DSA and engineering background, so I can go deep with devs when it matters',
      ] },
    ],
    tags: ['Scrum', 'Retros', 'Stakeholders', 'Claude', 'ChatGPT'],
  },
  {
    id: 'mum', code: 'NODE 10 · SETTLED', status: 4, short: 'MUMBAI', landmark: 'sealink', side: 1,
    title: 'Mumbai',
    subtitle: 'Transaction successful. Payee: your team?',
    meta: ['Open to TPM / PM roles', 'Fintech · Payments · HR-tech'],
    intro: 'You’ve seen the route: IIT Dharwad CS, engineering roots, then full ownership of five banking products at ICICI. If you’re building in fintech, payments or HR-tech, let’s talk.',
    sections: [],
    tags: ['Product', 'Fintech', 'Banking', 'Payments'],
    final: true,
  },
];
