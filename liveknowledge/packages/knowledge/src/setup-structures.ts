// The knowledgebase structures (docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen"): liveknowledge's
// templates, offered on a new knowledgebase's start, in the landing page's template gallery and on Home. Each is the
// whole shape of a knowledgebase, a tree of titled pages with a line on what belongs on each and the headings its
// writing would sit under: structure, never sample writing. A structure becomes a SetupSuggestion through the parser
// a model's reply goes through (parseSetupSuggestion), so a structure picked here and one the AI proposes are one
// shape, created by one path, within the same bounds.
import { parseSetupSuggestion, type SetupSuggestion } from './setup-suggestion';

/** One page of a structure's outline, with its subpages. */
export type StructurePage = {
  title: string;
  summary: string;
  headings: readonly string[];
  pages: readonly StructurePage[];
};

/** Who a structure is for: the start's rail group it sits in. */
export type StructureGroup = 'team' | 'engineering' | 'product' | 'support';

export type SetupStructure = {
  id: string;
  name: string;
  line: string;
  group: StructureGroup;
  pages: readonly StructurePage[];
};

export const STRUCTURE_GROUPS: readonly { id: StructureGroup; name: string; line: string }[] = [
  {
    id: 'team',
    name: 'Company and Team',
    line: 'How the company and its teams work, and how someone new finds their feet.',
  },
  {
    id: 'engineering',
    name: 'Engineering',
    line: 'How the systems are built, shipped and kept running.',
  },
  {
    id: 'product',
    name: 'Product and Research',
    line: 'What the product does, what is learned about its users and how projects run.',
  },
  {
    id: 'support',
    name: 'Customers',
    line: 'How customers are reached, won, helped and kept.',
  },
];

const p = (
  title: string,
  summary: string,
  headings: readonly string[] = [],
  pages: readonly StructurePage[] = [],
): StructurePage => ({ title, summary, headings, pages });

export const SETUP_STRUCTURES: readonly SetupStructure[] = [
  {
    id: 'company-knowledgebase',
    name: 'Company Knowledgebase',
    line: 'Everything about the company in one place: who does what, how it works and the news.',
    group: 'team',
    pages: [
      p('Welcome', 'What the company does, and how to find your way around.', [
        'About Us',
        'Finding Your Way',
      ]),
      p(
        'Company',
        'Where the company has come from, and where it is going.',
        [],
        [
          p('Mission and Values', 'What the company is for, and what it holds to.', [
            'Mission',
            'Values',
          ]),
          p('Strategy', 'The plan for this year, and how it is measured.', [
            'This Year',
            'How We Measure It',
          ]),
          p('History', 'How the company got here.', ['Milestones']),
        ],
      ),
      p(
        'Teams',
        'Every team, what it owns and how to reach it.',
        ['Team Directory'],
        [
          p('Leadership', 'Who leads the company, and what each of them looks after.', [
            'Leadership Team',
          ]),
          p('Departments', 'Each department and what it does.', ['Who Does What']),
        ],
      ),
      p(
        'People',
        'Everything about working here.',
        [],
        [
          p('Benefits', 'What the company offers, and how to use it.', [
            'Health',
            'Pension',
            'Learning',
          ]),
          p('Time Off', 'Holidays, sick leave and other leave.', [
            'Holiday',
            'Sick Leave',
            'Other Leave',
          ]),
          p('Offices and Remote Work', 'Where people work, and the rules for each.', [
            'Offices',
            'Working Remotely',
          ]),
        ],
      ),
      p('Announcements', 'Company news, newest first.', ['Latest']),
      p('Glossary', 'The words and abbreviations used here.', ['Terms']),
    ],
  },
  {
    id: 'team-handbook',
    name: 'Team Handbook',
    line: 'Who the team is, how it works together and the policies everyone follows.',
    group: 'team',
    pages: [
      p('Welcome', 'What this team does, and how to find your way around this handbook.', [
        'What We Do',
        'How to Use This Handbook',
      ]),
      p('Who We Are', 'The people on the team and what each of them looks after.', [
        'The Team',
        'Who to Ask',
      ]),
      p(
        'How We Work',
        'The rhythms and habits the team shares.',
        ['Our Values'],
        [
          p('Meetings', 'Which meetings the team holds, when, and what each is for.', [
            'Weekly',
            'Planning',
            'Retrospectives',
          ]),
          p('Communication', 'Where to talk, and what to expect back.', [
            'Channels',
            'Response Times',
          ]),
          p('Decisions', 'How the team makes and records a decision.', [
            'Who Decides',
            'Recording a Decision',
          ]),
        ],
      ),
      p(
        'Policies',
        'The rules everyone on the team follows.',
        [],
        [
          p('Time Off', 'How to take holiday and sick leave.', ['Booking Time Off', 'Sick Leave']),
          p('Expenses', 'What can be claimed, and how.', ['What You Can Claim', 'How to Claim']),
          p('Working Remotely', 'Working from home and away.', ['Equipment', 'Security']),
        ],
      ),
      p('Tools', 'The tools the team uses and how to get access.', ['Accounts', 'Getting Access']),
    ],
  },
  {
    id: 'onboarding',
    name: 'Onboarding',
    line: 'A new starter’s path through their first weeks, and what to read along the way.',
    group: 'team',
    pages: [
      p('Start Here', 'Welcome, and what the first weeks look like.', ['Welcome', 'Your Buddy']),
      p(
        'Your First Week',
        'What to set up and who to meet in the first five days.',
        [],
        [
          p('Day One', 'Accounts, equipment and the first meetings.', [
            'Before You Arrive',
            'On the Day',
          ]),
          p('Setting Up', 'Getting every tool and account working.', ['Accounts', 'Equipment']),
          p('People to Meet', 'The introductions to make, and why.', [
            'Your Team',
            'Across the Company',
          ]),
        ],
      ),
      p('Your First Month', 'What to learn and deliver by the end of the first month.', [
        'Goals',
        'Check-Ins',
      ]),
      p(
        'How the Company Works',
        'The background everyone is expected to know.',
        [],
        [
          p('Our Mission', 'What the company is for, and where it is going.', [
            'Mission',
            'Strategy',
          ]),
          p('Teams', 'The teams and what each one does.', ['Who Does What']),
          p('Glossary', 'The words and abbreviations people use here.', ['Terms']),
        ],
      ),
      p('Frequently Asked Questions', 'The questions new starters ask most.', [
        'Getting Paid',
        'Time Off',
      ]),
    ],
  },
  {
    id: 'engineering-handbook',
    name: 'Engineering Handbook',
    line: 'How the systems fit together, how code is written and reviewed, and how it ships.',
    group: 'engineering',
    pages: [
      p('Overview', 'What engineering builds, and how this knowledgebase is arranged.', [
        'Our Systems',
        'Where to Start',
      ]),
      p(
        'Architecture',
        'How the systems fit together.',
        ['The Big Picture'],
        [
          p('Services', 'Each service, what it owns and who looks after it.', [
            'Service List',
            'Owners',
          ]),
          p('Data', 'Where data lives and how it moves.', ['Databases', 'Data Flow']),
          p('Decisions', 'The architecture decisions taken, and why.', ['Decision Log']),
        ],
      ),
      p(
        'Development',
        'How code is written and reviewed here.',
        [],
        [
          p('Local Setup', 'Getting the code running on your machine.', [
            'Prerequisites',
            'Running Locally',
          ]),
          p('Code Style', 'The conventions code follows.', ['Naming', 'Formatting']),
          p('Code Review', 'How a change is reviewed and approved.', [
            'Opening a Change',
            'Reviewing',
          ]),
          p('Testing', 'What is tested, and how.', ['Unit Tests', 'End-to-End Tests']),
        ],
      ),
      p(
        'Shipping',
        'How a change reaches people.',
        [],
        [
          p('Release Process', 'How and when changes are released.', [
            'Before a Release',
            'Releasing',
          ]),
          p('On-Call', 'Who is on call, and what they do.', ['The Rota', 'When You Are Paged']),
        ],
      ),
    ],
  },
  {
    id: 'runbooks',
    name: 'Runbooks and On-Call',
    line: 'What to do when something breaks: the rota, the incident process and a runbook per system.',
    group: 'engineering',
    pages: [
      p('On-Call', 'How on-call works, and what is expected of whoever holds it.', [
        'The Rota',
        'Handing Over',
        'Escalation',
      ]),
      p(
        'Incidents',
        'How an incident is run, from the first alert to the review.',
        [],
        [
          p('Declaring an Incident', 'When something counts as an incident, and the first steps.', [
            'Severity',
            'First Steps',
          ]),
          p('During an Incident', 'Roles, updates and keeping people informed.', [
            'Roles',
            'Status Updates',
          ]),
          p('After an Incident', 'Writing the review and following up.', [
            'The Review',
            'Follow-Ups',
          ]),
        ],
      ),
      p(
        'Runbooks',
        'Step-by-step fixes, one page per system.',
        ['How to Write a Runbook'],
        [
          p('Website Down', 'What to check and do when the website stops answering.', [
            'Symptoms',
            'Checks',
            'Fix',
          ]),
          p('Database', 'Slow queries, full disks and failovers.', ['Symptoms', 'Checks', 'Fix']),
          p('Deploy Rollback', 'Taking a bad release back.', ['When to Roll Back', 'Rolling Back']),
        ],
      ),
      p('Contacts', 'Who to call, inside and outside the company.', ['People', 'Suppliers']),
    ],
  },
  {
    id: 'product-docs',
    name: 'Product Docs',
    line: 'What the product does and how to use it: guides, features and what changed.',
    group: 'product',
    pages: [
      p('Introduction', 'What the product is, and who it is for.', [
        'What It Does',
        'Who It Is For',
      ]),
      p(
        'Getting Started',
        'The first steps with the product.',
        [],
        [
          p('Quick Start', 'From signing up to the first result in a few minutes.', [
            'Sign Up',
            'First Steps',
          ]),
          p('Key Concepts', 'The ideas the rest of the docs rely on.', ['Concepts']),
        ],
      ),
      p(
        'Features',
        'Each feature, what it does and how to use it.',
        [],
        [
          p('Feature One', 'What the first feature does and how to use it.', [
            'What It Does',
            'How to Use It',
          ]),
          p('Feature Two', 'What the second feature does and how to use it.', [
            'What It Does',
            'How to Use It',
          ]),
          p('Settings', 'Every setting, and what it changes.', ['Account', 'Workspace']),
        ],
      ),
      p('Integrations', 'Connecting the product to other tools.', [
        'Available Integrations',
        'Setting Up',
      ]),
      p('Release Notes', 'What changed in each release.', ['Latest Release']),
    ],
  },
  {
    id: 'support-knowledgebase',
    name: 'Support Knowledgebase',
    line: 'Answers for customers and the support team: common questions, troubleshooting and how support works.',
    group: 'support',
    pages: [
      p('Help Center', 'Where to find an answer, and how to reach us.', [
        'Finding an Answer',
        'Contact Us',
      ]),
      p(
        'Account and Billing',
        'Signing in, plans and payments.',
        [],
        [
          p('Signing In', 'Passwords, sign-in links and locked accounts.', [
            'Resetting a Password',
          ]),
          p('Plans and Pricing', 'What each plan includes.', ['Plans', 'Changing Plan']),
          p('Invoices', 'Finding, paying and correcting an invoice.', [
            'Finding an Invoice',
            'Refunds',
          ]),
        ],
      ),
      p(
        'Troubleshooting',
        'Fixes for the problems people meet most.',
        [],
        [
          p('Common Errors', 'Each error message, what it means and the fix.', ['Error Messages']),
          p('Performance', 'When things are slow.', ['Checks', 'Fixes']),
        ],
      ),
      p(
        'For the Support Team',
        'How the support team works.',
        [],
        [
          p('Answering Tickets', 'How to answer a ticket well.', ['Tone', 'Templates']),
          p('Escalation', 'When and how to pass a ticket on.', ['When to Escalate', 'Who to Ask']),
        ],
      ),
    ],
  },
  {
    id: 'design-system',
    name: 'Design System',
    line: 'The foundations, components and patterns the product is built from, and how to change them.',
    group: 'engineering',
    pages: [
      p('Overview', 'What the design system covers, who it is for and how to start using it.', [
        'What It Covers',
        'Getting Started',
      ]),
      p(
        'Foundations',
        'The decisions every component is built on.',
        [],
        [
          p('Colour', 'The palette, its tokens and where each colour is used.', [
            'Palette',
            'Tokens',
            'Contrast',
          ]),
          p('Typography', 'Typefaces, sizes and how text is set.', ['Typefaces', 'Type Scale']),
          p('Spacing and Layout', 'The spacing scale and the grid.', ['Spacing Scale', 'Grid']),
          p('Iconography', 'The icon set, and how to use it.', ['Icon Set', 'Usage']),
        ],
      ),
      p(
        'Components',
        'Each component, when to use it and how it behaves.',
        ['How to Read a Component Page'],
        [
          p('Buttons', 'Button kinds, sizes and states.', ['Kinds', 'States', 'Accessibility']),
          p('Forms', 'Fields, selects and validation.', ['Fields', 'Validation']),
          p('Navigation', 'Menus, tabs and breadcrumbs.', ['Menus', 'Tabs']),
          p('Feedback', 'Alerts, notices and empty states.', ['Alerts', 'Empty States']),
        ],
      ),
      p(
        'Patterns',
        'How components combine to solve common problems.',
        [],
        [
          p('Page Layouts', 'The page shapes the product is built from.', ['Layouts']),
          p('Content Guidelines', 'How the product’s words are written.', [
            'Voice and Tone',
            'Writing Labels',
          ]),
        ],
      ),
      p('Contributing', 'Proposing, building and releasing a change to the system.', [
        'Proposing a Change',
        'Release Notes',
      ]),
    ],
  },
  {
    id: 'research-library',
    name: 'Research Library',
    line: 'Every study in one place, what they add up to, and how research is done here.',
    group: 'product',
    pages: [
      p('About This Library', 'What is kept here, and how to find a study.', [
        'What Is Here',
        'Finding a Study',
      ]),
      p(
        'Studies',
        'Each study: its question, its method and what it found.',
        ['How to Write Up a Study'],
        [
          p('Interviews', 'Interview studies, one page each.', ['Recent Interviews']),
          p('Usability Tests', 'Usability tests, and what they showed.', ['Recent Tests']),
          p('Surveys', 'Surveys, their questions and their results.', ['Recent Surveys']),
        ],
      ),
      p(
        'Insights',
        'What the research adds up to, across studies.',
        [],
        [
          p('Key Findings', 'The findings that hold across several studies.', ['Findings']),
          p('Personas', 'Who the users are, and what they need.', ['Personas']),
          p('Open Questions', 'What is not known yet, and how it could be learned.', ['Questions']),
        ],
      ),
      p(
        'Methods',
        'How research is done here.',
        [],
        [
          p('Planning a Study', 'Writing the question, choosing a method and recruiting.', [
            'The Question',
            'Choosing a Method',
            'Recruiting',
          ]),
          p('Consent and Data', 'Consent, recordings and how long data is kept.', [
            'Consent',
            'Storing Data',
          ]),
        ],
      ),
      p('Participants', 'Who has taken part, and how to reach new people.', [
        'The Panel',
        'Finding Participants',
      ]),
    ],
  },
  {
    id: 'project-hub',
    name: 'Project Hub',
    line: 'One project from start to finish: its plan, its decisions, its meetings and how it went.',
    group: 'product',
    pages: [
      p('Overview', 'What the project is for, who is on it and where it stands.', [
        'Goals',
        'Team',
        'Status',
      ]),
      p(
        'Planning',
        'What will be done, and when.',
        [],
        [
          p('Scope', 'What is in the project, and what is not.', ['In Scope', 'Out of Scope']),
          p('Roadmap', 'The milestones, and their dates.', ['Milestones']),
          p('Risks', 'What could go wrong, and what is being done about it.', ['Risk Log']),
        ],
      ),
      p('Decisions', 'Each decision taken, with its reasons.', ['Decision Log']),
      p(
        'Meetings',
        'Notes from the project’s meetings, newest first.',
        [],
        [
          p('Kickoff', 'The first meeting: goals, roles and ways of working.', ['Goals', 'Roles']),
          p('Weekly Updates', 'What happened this week, and what is next.', [
            'This Week',
            'Next Week',
          ]),
        ],
      ),
      p('Status Reports', 'Regular reports for the people the project answers to.', [
        'Latest Report',
      ]),
      p('Retrospective', 'What went well, what did not and what to change next time.', [
        'What Went Well',
        'What to Change',
      ]),
    ],
  },
  {
    id: 'sales-playbook',
    name: 'Sales Playbook',
    line: 'Who buys and why, each stage of a deal, and what to say and show at each.',
    group: 'support',
    pages: [
      p('Start Here', 'How the sales team works, and how to use this playbook.', [
        'How We Sell',
        'Using This Playbook',
      ]),
      p(
        'Our Customers',
        'Who buys, and why.',
        [],
        [
          p('Ideal Customer', 'The companies that get the most from the product.', [
            'Who They Are',
            'Signs of a Good Fit',
          ]),
          p('Buyer Personas', 'The people in a deal, and what each of them cares about.', [
            'Personas',
          ]),
        ],
      ),
      p(
        'Sales Process',
        'Each stage of a deal, from first contact to signature.',
        ['Stages'],
        [
          p('Prospecting', 'Finding new leads, and reaching them.', [
            'Where Leads Come From',
            'First Contact',
          ]),
          p('Discovery', 'Learning what the customer needs.', ['Questions to Ask']),
          p('Demo', 'Showing the product to fit what was learned.', [
            'Preparing',
            'Running the Demo',
          ]),
          p('Closing', 'Proposals, pricing and contracts.', ['Proposals', 'Contracts']),
        ],
      ),
      p(
        'Selling Tools',
        'What to say, and what to show.',
        [],
        [
          p('Pitch', 'The story, in one minute and in ten.', ['Short Pitch', 'Full Pitch']),
          p('Objections', 'The common objections, and how to answer each.', ['Objections']),
          p('Competitors', 'How the product compares with each competitor.', ['Comparisons']),
        ],
      ),
      p('Pricing', 'Plans, discounts and who may approve them.', ['Plans', 'Discounts']),
    ],
  },
  {
    id: 'customer-success',
    name: 'Customer Success',
    line: 'Getting customers to their first result, keeping them healthy and renewing them.',
    group: 'support',
    pages: [
      p('Overview', 'What customer success does, and for whom.', ['Our Role', 'Who We Look After']),
      p('Onboarding Customers', 'Getting a new customer to their first result.', [
        'Kickoff',
        'The First 90 Days',
      ]),
      p(
        'Account Management',
        'Looking after a customer once they are live.',
        [],
        [
          p('Health Scores', 'How an account’s health is measured, and what each score means.', [
            'Signals',
            'Scores',
          ]),
          p('Business Reviews', 'The regular review with each customer.', [
            'Preparing',
            'Running the Review',
          ]),
          p('Renewals', 'Renewing an account, and growing it.', ['Timeline', 'Expansion']),
        ],
      ),
      p(
        'Playbooks',
        'What to do in the moments that matter.',
        [],
        [
          p('At-Risk Accounts', 'Spotting an account that may leave, and what to do.', [
            'Warning Signs',
            'Saving the Account',
          ]),
          p('Escalations', 'When a customer’s problem needs more people.', [
            'When to Escalate',
            'Who to Involve',
          ]),
        ],
      ),
      p('Customer Feedback', 'What customers ask for, and how it reaches the product team.', [
        'Collecting Feedback',
        'Sharing It',
      ]),
    ],
  },
  {
    id: 'people-operations',
    name: 'People Operations',
    line: 'How people are hired, paid, grown and looked after, from the first interview to the last day.',
    group: 'team',
    pages: [
      p('Overview', 'What the people team looks after, and how to reach it.', [
        'What We Do',
        'Contact Us',
      ]),
      p(
        'Hiring',
        'How a role is opened, filled and welcomed.',
        [],
        [
          p('Opening a Role', 'Writing the role, and getting it approved.', [
            'The Role',
            'Approval',
          ]),
          p('Interviews', 'The stages of an interview, and how each is scored.', [
            'Stages',
            'Scoring',
          ]),
          p('Offers', 'Making an offer, and what happens after a yes.', [
            'Making an Offer',
            'Before Day One',
          ]),
        ],
      ),
      p(
        'Pay and Benefits',
        'How pay is set, and what comes with it.',
        [],
        [
          p('Pay', 'Pay bands, pay days and pay reviews.', ['Pay Bands', 'Pay Reviews']),
          p('Benefits', 'What the company offers, and how to claim it.', ['Benefits']),
        ],
      ),
      p(
        'Growth',
        'How people grow here.',
        [],
        [
          p('Performance Reviews', 'When reviews happen, and how they are written.', [
            'The Cycle',
            'Writing a Review',
          ]),
          p('Career Levels', 'What each level expects.', ['Levels']),
          p('Learning', 'Courses, books and the learning budget.', ['Learning Budget']),
        ],
      ),
      p('Leaving', 'What happens when someone leaves.', ['Notice', 'The Last Day']),
    ],
  },
  {
    id: 'api-docs',
    name: 'API Docs',
    line: 'Everything a developer needs to use the API: getting started, every endpoint and what changed.',
    group: 'engineering',
    pages: [
      p('Introduction', 'What the API does, and what a developer needs to begin.', [
        'What You Can Build',
        'Before You Start',
      ]),
      p(
        'Getting Started',
        'From a key to the first call.',
        [],
        [
          p('Authentication', 'Getting a key, and sending it with each request.', [
            'API Keys',
            'Sending a Key',
          ]),
          p('First Request', 'A first call, step by step.', ['Making a Request', 'The Response']),
        ],
      ),
      p(
        'Reference',
        'Every endpoint, its parameters and its responses.',
        ['Conventions'],
        [
          p('Endpoints', 'Each endpoint, grouped by what it works on.', ['Endpoints']),
          p('Errors', 'Every error code, and what to do about it.', ['Error Codes']),
          p('Rate Limits', 'How many requests are allowed, and what happens past that.', [
            'Limits',
            'Retrying',
          ]),
          p('Webhooks', 'The events the API sends, and how to receive them.', [
            'Events',
            'Verifying a Webhook',
          ]),
        ],
      ),
      p('Libraries', 'The client libraries, by language.', ['Libraries']),
      p('Changelog', 'What changed in each version of the API.', ['Latest Changes']),
    ],
  },
  {
    id: 'product-strategy',
    name: 'Product Strategy',
    line: 'Where the product is going and why: its vision, its roadmap, the bets and how they are measured.',
    group: 'product',
    pages: [
      p('Vision', 'What the product will be, and for whom.', ['Vision', 'Who It Is For']),
      p(
        'Strategy',
        'How the product gets there.',
        [],
        [
          p('Market', 'The market, the customers in it and the competition.', [
            'The Market',
            'Competitors',
          ]),
          p('Principles', 'The rules product decisions follow.', ['Principles']),
          p('Bets', 'The big bets for this year, and why each one.', ['This Year']),
        ],
      ),
      p(
        'Roadmap',
        'What is being built now, next and later.',
        ['Now', 'Next', 'Later'],
        [
          p('Launches', 'Each launch: what shipped, and how it was announced.', [
            'Recent Launches',
          ]),
        ],
      ),
      p('Metrics', 'How success is measured, and the numbers today.', ['Key Metrics', 'Targets']),
      p('Decisions', 'Product decisions taken, with their reasons.', ['Decision Log']),
    ],
  },
  {
    id: 'marketing-playbook',
    name: 'Marketing Playbook',
    line: 'The brand, the message and the channels, and how a campaign is run from brief to results.',
    group: 'support',
    pages: [
      p('Overview', 'What marketing does, and how to work with it.', [
        'Our Goals',
        'Working With Us',
      ]),
      p(
        'Brand',
        'How the company looks and sounds.',
        [],
        [
          p('Voice and Tone', 'How the company writes.', ['Voice', 'Tone']),
          p('Visual Identity', 'The logo, colours and type, and how to use them.', [
            'Logo',
            'Colours',
          ]),
        ],
      ),
      p('Messaging', 'What the company says, and to whom.', ['Positioning', 'Key Messages']),
      p(
        'Channels',
        'Where the company reaches people.',
        [],
        [
          p('Website', 'The website, and how it is changed.', ['Pages', 'Making a Change']),
          p('Email', 'Newsletters and campaigns.', ['Lists', 'Sending']),
          p('Social', 'The social accounts, and how they are run.', ['Accounts', 'Posting']),
        ],
      ),
      p(
        'Campaigns',
        'How a campaign is planned, run and measured.',
        [],
        [
          p('Campaign Brief', 'What every campaign starts with.', ['The Brief']),
          p('Results', 'What each campaign achieved.', ['Recent Campaigns']),
        ],
      ),
    ],
  },
];

// The outline as a model's reply has it: every page an object with its own id and its parent's.
function replyOf(structure: SetupStructure): string {
  const pages: object[] = [];
  const walk = (list: readonly StructurePage[], parent: string | null) => {
    for (const page of list) {
      const id = `s${pages.length + 1}`;
      pages.push({
        id,
        parent,
        title: page.title,
        summary: page.summary,
        headings: page.headings,
      });
      walk(page.pages, id);
    }
  };
  walk(structure.pages, null);
  return JSON.stringify({ name: structure.name, pages });
}

/** The structure as Describe to Set Up's suggestion: read by the parser a model's reply goes through. */
export function structureSuggestion(structure: SetupStructure): SetupSuggestion {
  // Every structure here reads whole (setup-structures.test.ts); the fallback is the empty knowledgebase it starts as.
  return parseSetupSuggestion(replyOf(structure)) ?? { name: structure.name, pages: [] };
}

/** A structure by its id. */
export const setupStructure = (id: string): SetupStructure | undefined =>
  SETUP_STRUCTURES.find((s) => s.id === id);

// Every page title in a structure, at every level, in tree order.
const titlesOf = (pages: readonly StructurePage[]): string[] =>
  pages.flatMap((page) => [page.title, ...titlesOf(page.pages)]);

/** Every page title a structure makes, at every level: what a search of the structures reads beside its name. */
export const structurePageTitles = (structure: SetupStructure): string[] =>
  titlesOf(structure.pages);

/** How many pages a structure makes. */
export const structurePageCount = (structure: SetupStructure): number =>
  titlesOf(structure.pages).length;

/** A structure's outline, two levels: each top page, with its subpages' titles after it. At most `max` lines: past
 *  that, one line fewer and the rest counted on the last. The editor's start and the landing gallery draw it. */
export function structureOutline(
  structure: SetupStructure,
  max = 5,
): { lines: { title: string; under: string[] }[]; more: number } {
  const all = structure.pages.map((page) => ({
    title: page.title,
    under: page.pages.map((sub) => sub.title),
  }));
  if (all.length <= max) return { lines: all, more: 0 };
  return { lines: all.slice(0, max - 1), more: all.length - (max - 1) };
}
