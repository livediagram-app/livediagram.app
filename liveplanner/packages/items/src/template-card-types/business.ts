// The content, people, launch and customer templates' own card types (docs/specs/026-plan/plan-templates.md "Card
// types a template makes"): Content Calendar, Editorial Pipeline, Hiring Pipeline, Product Launch, Feedback Board,
// Event Planner, Sales CRM, Help Desk and Client Onboarding. Pure data.
import type { ItemTypeDef } from '../item-types';
import {
  card,
  checklist,
  choice,
  date,
  detailed,
  email,
  link,
  money,
  number,
  parentOf,
  phone,
  template,
  text,
} from './kit';

const CHANNELS = ['Blog', 'Newsletter', 'Social', 'Video', 'Podcast'];

// ---- Content Calendar: posts from idea to published, and the work behind them -------------------------------------

const CC: ItemTypeDef[] = [
  {
    id: 'cc-post',
    label: 'Post',
    newTitle: 'New post',
    glyph: 'megaphone',
    color: '#db2777',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-channel',
      'f-audience',
      'due',
      'f-link',
      'votes',
      'checklist',
      'labels',
    ],
    custom: [
      choice('f-channel', 'Channel', CHANNELS),
      text('f-audience', 'Audience'),
      link('f-link', 'Link'),
    ],
    display: detailed(['f-channel'], ['due']),
    templates: [
      template('tp-blog-post', 'Blog Post', {
        'f-channel': 'Blog',
        checklist: checklist([
          ['Outline'],
          ['First draft'],
          ['Edit'],
          ['Images with alt text'],
          ['Search title and summary'],
        ]),
      }),
      template('tp-newsletter', 'Newsletter', {
        'f-channel': 'Newsletter',
        checklist: checklist([
          ['Lead story'],
          ['Every link checked'],
          ['Test send'],
          ['Scheduled'],
        ]),
      }),
      template('tp-social-post', 'Social Post', {
        'f-channel': 'Social',
        checklist: checklist([['Copy written'], ['Image or video'], ['Alt text'], ['Scheduled']]),
      }),
    ],
  },
  {
    id: 'cc-task',
    label: 'Production Task',
    newTitle: 'New production task',
    glyph: 'wrench',
    color: '#64748b',
    fields: ['title', 'description', 'status', 'assignee', 'parent', 'due', 'checklist', 'labels'],
    custom: [parentOf('cc-post')],
    templates: [
      template('tp-design-assets', 'Design Assets', {
        labels: ['design'],
        checklist: checklist([['Brief written'], ['Drafts reviewed'], ['Final files exported']]),
      }),
    ],
  },
];

// ---- Editorial Pipeline: pitches commissioned, written, edited, checked and published -----------------------------

const ED: ItemTypeDef[] = [
  {
    id: 'ed-article',
    label: 'Article',
    newTitle: 'New article',
    glyph: 'page',
    color: '#be185d',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-channel',
      'f-writer',
      'f-words',
      'f-fee',
      'due',
      'f-link',
      'votes',
      'checklist',
      'labels',
    ],
    custom: [
      choice('f-channel', 'Channel', CHANNELS),
      text('f-writer', 'Writer'),
      number('f-words', 'Word Count'),
      money('f-fee', 'Fee'),
      link('f-link', 'Link'),
    ],
    display: detailed(['f-writer', 'f-words'], ['due']),
    templates: [
      template('tp-pitch', 'Pitch', {
        description: 'The angle, in one line:\n\nWhy now:\n\nWho we would talk to:',
      }),
      template('tp-feature', 'Long Read', {
        'f-words': 2500,
        checklist: checklist([
          ['Interviews done'],
          ['First draft'],
          ['Edit'],
          ['Fact check'],
          ['Headline and standfirst'],
        ]),
      }),
    ],
  },
  {
    id: 'ed-task',
    label: 'Production Task',
    newTitle: 'New production task',
    glyph: 'wrench',
    color: '#64748b',
    fields: ['title', 'description', 'status', 'assignee', 'parent', 'due', 'checklist', 'labels'],
    custom: [parentOf('ed-article')],
    templates: [
      template('tp-photo-commission', 'Photo Commission', {
        labels: ['pictures'],
        checklist: checklist([
          ['Photographer booked'],
          ['Shoot done'],
          ['Pictures picked'],
          ['Captions written'],
        ]),
      }),
    ],
  },
];

// ---- Hiring Pipeline: roles, the candidates for each, and a new starter's first month -----------------------------

const HP: ItemTypeDef[] = [
  {
    id: 'hp-role',
    label: 'Role',
    newTitle: 'New role',
    glyph: 'briefcase',
    color: '#0891b2',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-team',
      'f-location',
      'f-employment',
      'f-salary',
      'priority',
      'color',
      'start',
      'due',
      'checklist',
      'labels',
    ],
    custom: [
      text('f-team', 'Team'),
      text('f-location', 'Location'),
      choice('f-employment', 'Employment', ['Full-time', 'Part-time', 'Contract', 'Internship']),
      text('f-salary', 'Salary Range'),
    ],
    fieldLabels: { assignee: 'Hiring Manager' },
    display: detailed(['f-team', 'f-location'], ['start', 'due']),
    templates: [
      template('tp-engineering-role', 'Engineering Role', {
        'f-team': 'Engineering',
        'f-employment': 'Full-time',
        checklist: checklist([
          ['Job description agreed'],
          ['Interview panel picked'],
          ['Posted'],
          ['Shared with the team'],
        ]),
      }),
    ],
  },
  {
    id: 'hp-candidate',
    label: 'Candidate',
    newTitle: 'New candidate',
    glyph: 'user-plus',
    color: '#db2777',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-role',
      'f-source',
      'f-profile',
      'f-email',
      'f-years',
      'due',
      'checklist',
      'labels',
    ],
    custom: [
      card('f-role', 'Role', 'hp-role'),
      choice('f-source', 'Source', ['Referral', 'Job Board', 'Inbound', 'Agency', 'Sourced']),
      link('f-profile', 'Profile'),
      email(),
      // The Application form's Years of Experience.
      number('f-years', 'Years of Experience'),
    ],
    fieldLabels: { assignee: 'Recruiter' },
    display: detailed(['f-role'], ['due']),
    templates: [
      template('tp-interview-loop', 'Interview Loop', {
        checklist: checklist([
          ['Screen call'],
          ['Skills interview'],
          ['Team interview'],
          ['References'],
          ['Decision'],
        ]),
      }),
      template('tp-referral', 'Referral', {
        'f-source': 'Referral',
        description: 'Referred by:\n\nWhy they would be great:',
        checklist: checklist([['Thank the referrer'], ['Screen call'], ['Decision']]),
      }),
    ],
  },
  {
    id: 'hp-onboarding',
    label: 'Onboarding Step',
    newTitle: 'New onboarding step',
    glyph: 'checklist',
    color: '#16a34a',
    fields: ['title', 'description', 'status', 'assignee', 'f-new-starter', 'due', 'checklist'],
    custom: [card('f-new-starter', 'New Starter', 'hp-candidate')],
    display: detailed(['f-new-starter'], ['due']),
    templates: [
      template('tp-laptop-and-accounts', 'Laptop and Accounts', {
        checklist: checklist([
          ['Order the laptop'],
          ['Email and calendar'],
          ['Team chat'],
          ['Password manager'],
          ['Access to the tools they need'],
        ]),
      }),
      template('tp-first-week-plan', 'First Week Plan', {
        checklist: checklist([
          ['Meet the team'],
          ['Coffee with their buddy'],
          ['A first small task'],
          ['End-of-week check-in'],
        ]),
      }),
    ],
  },
];

// ---- Product Launch: workstreams, their tasks, and launch day's go / no-go -----------------------------------------

const PL: ItemTypeDef[] = [
  {
    id: 'pl-workstream',
    label: 'Workstream',
    newTitle: 'New workstream',
    glyph: 'release',
    color: '#4f46e5',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-owner-team',
      'priority',
      'color',
      'start',
      'due',
      'checklist',
      'labels',
    ],
    custom: [
      choice('f-owner-team', 'Team', ['Product', 'Engineering', 'Marketing', 'Sales', 'Support']),
    ],
    display: detailed(['f-owner-team'], ['start', 'due']),
    templates: [
      template('tp-go-to-market', 'Go to Market', {
        'f-owner-team': 'Marketing',
        checklist: checklist([
          ['Positioning agreed'],
          ['Launch post drafted'],
          ['Press list ready'],
          ['Sales briefed'],
        ]),
      }),
    ],
  },
  {
    id: 'pl-task',
    label: 'Launch Task',
    newTitle: 'New launch task',
    glyph: 'task',
    color: '#0891b2',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'parent',
      'priority',
      'due',
      'checklist',
      'labels',
    ],
    custom: [parentOf('pl-workstream')],
    templates: [
      template('tp-announcement', 'Announcement', {
        labels: ['comms'],
        checklist: checklist([['Copy written'], ['Reviewed by legal'], ['Scheduled']]),
      }),
    ],
  },
  {
    id: 'pl-check',
    label: 'Launch Check',
    newTitle: 'New launch check',
    glyph: 'flag',
    color: '#16a34a',
    fields: ['title', 'description', 'status', 'assignee', 'f-workstream', 'priority'],
    custom: [card('f-workstream', 'Workstream', 'pl-workstream')],
    display: detailed(['f-workstream']),
    templates: [
      template('tp-readiness', 'Readiness Check', {
        description: 'Go when:\n\nNo-go if:',
      }),
    ],
  },
];

// ---- Feedback Board: what customers ask for, and the work that delivers it ----------------------------------------

const FB: ItemTypeDef[] = [
  {
    id: 'fb-feedback',
    label: 'Feedback',
    newTitle: 'New feedback',
    glyph: 'chat',
    color: '#ea580c',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'priority',
      'f-requested-by',
      'f-email',
      'f-area',
      'due',
      'votes',
      'labels',
    ],
    custom: [
      text('f-requested-by', 'Requested By'),
      email(),
      choice('f-area', 'Area', ['Onboarding', 'Editor', 'Sharing', 'Billing', 'Mobile']),
    ],
    display: detailed(['f-requested-by', 'f-area']),
    templates: [
      template('tp-feature-request', 'Feature Request', {
        description: 'What they want to do:\n\nWhy it matters to them:\n\nHow they do it today:',
        labels: ['feature'],
      }),
      template('tp-annoyance', 'Annoyance', {
        description: 'What gets in their way, and how often:',
        labels: ['polish'],
      }),
    ],
  },
  {
    id: 'fb-task',
    label: 'Delivery Task',
    newTitle: 'New delivery task',
    glyph: 'task',
    color: '#0891b2',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'parent',
      'priority',
      'due',
      'votes',
      'checklist',
      'labels',
    ],
    custom: [parentOf('fb-feedback')],
    templates: [
      template('tp-tell-requesters', 'Tell Requesters', {
        description: 'Everyone who asked for this, told it shipped.',
        checklist: checklist([
          ['Release note written'],
          ['Requesters emailed'],
          ['Feedback card closed'],
        ]),
      }),
    ],
  },
];

// ---- Event Planner: workstreams to the day, and the tasks under them ----------------------------------------------

const EV: ItemTypeDef[] = [
  {
    id: 'ev-workstream',
    label: 'Workstream',
    newTitle: 'New workstream',
    glyph: 'calendar',
    color: '#7c3aed',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-budget',
      'priority',
      'color',
      'start',
      'due',
      'checklist',
      'labels',
    ],
    custom: [money('f-budget', 'Budget')],
    display: detailed(['f-budget'], ['start', 'due']),
    templates: [
      template('tp-venue', 'Venue', {
        checklist: checklist([
          ['Shortlist'],
          ['Site visits'],
          ['Contract signed'],
          ['Floor plan agreed'],
        ]),
      }),
      template('tp-catering', 'Catering', {
        checklist: checklist([['Dietary needs collected'], ['Menu picked'], ['Numbers confirmed']]),
      }),
    ],
  },
  {
    id: 'ev-task',
    label: 'Event Task',
    newTitle: 'New task',
    glyph: 'task',
    color: '#0891b2',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'parent',
      'f-supplier',
      'f-cost',
      'priority',
      'due',
      'checklist',
      'labels',
    ],
    custom: [parentOf('ev-workstream'), text('f-supplier', 'Supplier'), money('f-cost', 'Cost')],
    display: detailed(['f-supplier'], ['due']),
    templates: [
      template('tp-book-supplier', 'Book a Supplier', {
        checklist: checklist([
          ['Quotes from three'],
          ['Booked'],
          ['Deposit paid'],
          ['Day-of contact saved'],
        ]),
      }),
    ],
  },
];

// ---- Sales CRM: deals from lead to won -------------------------------------------------------------------------

const CRM: ItemTypeDef[] = [
  {
    id: 'crm-deal',
    label: 'Deal',
    newTitle: 'New deal',
    glyph: 'coin',
    color: '#16a34a',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-company',
      'f-value',
      'f-contact',
      'f-phone',
      'f-source',
      'f-next-step',
      'due',
      'checklist',
      'labels',
    ],
    custom: [
      text('f-company', 'Company'),
      money('f-value', 'Value'),
      text('f-contact', 'Contact'),
      phone('f-phone', 'Phone'),
      choice('f-source', 'Source', ['Inbound', 'Referral', 'Outbound', 'Event', 'Partner']),
      text('f-next-step', 'Next Step'),
    ],
    fieldLabels: { due: 'Expected Close' },
    display: detailed(['f-company', 'f-value'], ['due']),
    templates: [
      template('tp-inbound-lead', 'Inbound Lead', {
        'f-source': 'Inbound',
        checklist: checklist([
          ['Qualify: budget'],
          ['Qualify: decision maker'],
          ['Qualify: timeline'],
          ['Book a demo'],
        ]),
      }),
      template('tp-renewal', 'Renewal', {
        labels: ['renewal'],
        checklist: checklist([['Usage review'], ['Pricing agreed'], ['Contract sent'], ['Signed']]),
      }),
    ],
  },
];

// ---- Help Desk: customers' tickets, and the articles that answer them ---------------------------------------------

const HD: ItemTypeDef[] = [
  {
    id: 'hd-ticket',
    label: 'Ticket',
    newTitle: 'New ticket',
    glyph: 'ticket',
    color: '#2563eb',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'priority',
      'f-customer',
      'f-email',
      'f-channel',
      'due',
      'checklist',
      'labels',
    ],
    custom: [
      text('f-customer', 'Customer'),
      email(),
      choice('f-channel', 'Channel', ['Email', 'Chat', 'Phone', 'Form']),
    ],
    fieldLabels: { due: 'Reply By' },
    display: detailed(['f-customer'], ['due']),
    templates: [
      template('tp-somethings-broken', 'Something’s Broken', {
        description: 'What they tried, and what happened instead:',
        labels: ['bug'],
        checklist: checklist([
          ['Steps to reproduce'],
          ['Screenshot or recording'],
          ['Passed to engineering'],
        ]),
      }),
      template('tp-billing-question', 'Billing Question', {
        labels: ['billing'],
        checklist: checklist([['Find the invoice'], ['Explain the charge'], ['Refund if due']]),
      }),
      template('tp-refund-request', 'Refund Request', {
        labels: ['refund'],
        checklist: checklist([
          ['Order found'],
          ['Within the refund window'],
          ['Refund issued'],
          ['Customer told'],
        ]),
      }),
    ],
  },
  {
    id: 'hd-article',
    label: 'Help Article',
    newTitle: 'New article',
    glyph: 'book',
    color: '#0d9488',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-link',
      'f-reviewed',
      'checklist',
      'labels',
    ],
    custom: [link('f-link', 'Published At'), date('f-reviewed', 'Last Reviewed')],
    display: detailed([], ['f-reviewed']),
    templates: [
      template('tp-how-to', 'How-To', {
        description: 'What they want to do:\n\nSteps:\n1. …\n\nIf it does not work:',
        checklist: checklist([
          ['Screenshots'],
          ['Tried by someone new'],
          ['Linked from the tickets that asked'],
        ]),
      }),
    ],
  },
];

// ---- Client Onboarding: each client from signed to live, and the tasks that get them there -----------------------

const CO: ItemTypeDef[] = [
  {
    id: 'co-client',
    label: 'Client',
    newTitle: 'New client',
    glyph: 'building',
    color: '#4f46e5',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-contact',
      'f-email',
      'f-plan',
      'f-value',
      'priority',
      'color',
      'start',
      'due',
      'checklist',
      'labels',
    ],
    custom: [
      text('f-contact', 'Main Contact'),
      email(),
      choice('f-plan', 'Plan', ['Starter', 'Growth', 'Enterprise']),
      money('f-value', 'Contract Value'),
    ],
    fieldLabels: { assignee: 'Account Manager', due: 'Go-Live' },
    display: detailed(['f-plan', 'f-contact'], ['start', 'due']),
    templates: [
      template('tp-enterprise-client', 'Enterprise Client', {
        'f-plan': 'Enterprise',
        checklist: checklist([
          ['Security review'],
          ['Single sign-on set up'],
          ['Admin training'],
          ['Success plan agreed'],
        ]),
      }),
    ],
  },
  {
    id: 'co-task',
    label: 'Onboarding Task',
    newTitle: 'New task',
    glyph: 'checklist',
    color: '#16a34a',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'parent',
      'f-owner-side',
      'priority',
      'due',
      'checklist',
      'labels',
    ],
    custom: [parentOf('co-client'), choice('f-owner-side', 'Whose Move', ['Ours', 'Client’s'])],
    display: detailed(['f-owner-side'], ['due']),
    templates: [
      template('tp-kickoff-call', 'Kickoff Call', {
        'f-owner-side': 'Ours',
        checklist: checklist([['Agenda sent'], ['Goals written down'], ['Next steps shared']]),
      }),
      template('tp-data-import', 'Data Import', {
        'f-owner-side': 'Client’s',
        checklist: checklist([['Export received'], ['Imported'], ['Checked with the client']]),
      }),
    ],
  },
];

export const BUSINESS_TYPES: readonly ItemTypeDef[] = [
  ...CC,
  ...ED,
  ...HP,
  ...PL,
  ...FB,
  ...EV,
  ...CRM,
  ...HD,
  ...CO,
];
