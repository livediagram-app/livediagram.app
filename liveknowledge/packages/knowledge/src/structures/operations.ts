// The Operations structures (setup-structures.ts, docs/specs/030-knowledgebase/describe-to-set-up.md "The start
// screen"): the business underneath, its systems and security, money and contracts, data and decisions.
import { p, type SetupStructure } from './shape';

export const OPERATIONS_STRUCTURES: readonly SetupStructure[] = [
  {
    id: 'it-security',
    name: 'IT and Security',
    line: 'How people get access, look after their devices and keep data safe, and what to do when something goes wrong.',
    group: 'operations',
    pages: [
      p('Overview', 'What IT and security look after, and how to ask for help.', [
        'What We Look After',
        'Getting Help',
      ]),
      p(
        'Access',
        'Who can reach which systems, and how access is given and taken away.',
        ['How Access Works'],
        [
          p('Requesting Access', 'How to ask for a tool or a system, and who approves it.', [
            'Making a Request',
            'Approvals',
          ]),
          p(
            'Joiners and Leavers',
            'What is set up on someone’s first day and removed on their last.',
            ['First Day', 'Last Day'],
          ),
          p('Passwords and Sign-In', 'The password manager, two-step sign-in and single sign-on.', [
            'Password Manager',
            'Two-Step Sign-In',
          ]),
        ],
      ),
      p(
        'Devices',
        'The laptops and phones people use, and how they are kept safe.',
        [],
        [
          p('Laptops', 'Which laptop people get, how it is set up and how to replace it.', [
            'Standard Setup',
            'Repairs and Replacements',
          ]),
          p('Phones', 'Work phones, and using your own for work.', [
            'Work Phones',
            'Your Own Phone',
          ]),
          p('Lost or Stolen', 'What to do the moment a device goes missing.', [
            'First Steps',
            'Who to Tell',
          ]),
        ],
      ),
      p(
        'Policies',
        'The security rules everyone follows.',
        [],
        [
          p('Acceptable Use', 'What company systems and devices may be used for.', [
            'Allowed',
            'Not Allowed',
          ]),
          p('Data Handling', 'How data is classified, stored and shared.', [
            'Classification',
            'Sharing Safely',
          ]),
          p('Working Away', 'Staying safe on public networks and abroad.', [
            'Public Wi-Fi',
            'Travelling',
          ]),
        ],
      ),
      p(
        'Security Incidents',
        'How a suspected breach or a phishing email is reported and handled.',
        [],
        [
          p(
            'Reporting an Incident',
            'What counts as a security incident, and how to report one fast.',
            ['What to Report', 'How to Report'],
          ),
          p('Response Plan', 'The steps the response team follows, from first report to review.', [
            'Containment',
            'Recovery',
            'Review',
          ]),
        ],
      ),
      p('Systems Inventory', 'Every tool the company uses, its owner and who has access.', [
        'Tool List',
        'Owners',
      ]),
    ],
  },
  {
    id: 'finance-legal',
    name: 'Finance and Legal',
    line: 'How money is spent, claimed and approved, and the contracts and rules the company is bound by.',
    group: 'operations',
    pages: [
      p('Overview', 'Who looks after finance and legal, and when to come to them.', [
        'Who We Are',
        'When to Ask',
      ]),
      p(
        'Spending',
        'How money is spent and approved.',
        ['Spending Limits'],
        [
          p('Budgets', 'Each team’s budget, and how it is set and tracked.', [
            'Setting a Budget',
            'Tracking Spend',
          ]),
          p('Purchasing', 'Buying from a supplier, from the first quote to the purchase order.', [
            'Getting Quotes',
            'Purchase Orders',
          ]),
          p('Expenses', 'What can be claimed, and how to claim it.', [
            'What You Can Claim',
            'How to Claim',
          ]),
        ],
      ),
      p(
        'Invoices and Payments',
        'How the company bills its customers and pays its suppliers.',
        [],
        [
          p('Invoicing Customers', 'Raising an invoice, and chasing one that is late.', [
            'Raising an Invoice',
            'Late Payment',
          ]),
          p('Paying Suppliers', 'How a supplier’s invoice is checked, approved and paid.', [
            'Approval',
            'Payment Runs',
          ]),
        ],
      ),
      p('Payroll', 'When people are paid, and what to do if a payslip looks wrong.', [
        'Pay Dates',
        'Payslips',
        'Questions',
      ]),
      p(
        'Contracts',
        'The agreements the company signs, and how a new one is reviewed.',
        [],
        [
          p('Contract Review', 'How to get a contract checked before anyone signs it.', [
            'Sending for Review',
            'Who Can Sign',
          ]),
          p(
            'Standard Agreements',
            'The agreements to start from, so each deal does not begin blank.',
            ['Non-Disclosure Agreement', 'Supplier Agreement'],
          ),
          p('Contract Register', 'Every signed contract, its renewal date and its owner.', [
            'Active Contracts',
            'Renewals',
          ]),
        ],
      ),
      p(
        'Compliance',
        'The laws and rules the company keeps to.',
        [],
        [
          p(
            'Data Protection',
            'How personal data is handled, and the rights people have over it.',
            ['Personal Data', 'Requests From Individuals'],
          ),
          p(
            'Company Policies',
            'Anti-bribery, conflicts of interest and the other policies everyone signs.',
            ['Anti-Bribery', 'Conflicts of Interest'],
          ),
        ],
      ),
      p('Year End and Audit', 'Closing the financial year, and what the auditors ask for.', [
        'Timeline',
        'What Auditors Need',
      ]),
    ],
  },
  {
    id: 'data-analytics',
    name: 'Data and Analytics',
    line: 'What every metric means, where the data comes from and how to find, trust and ask for a number.',
    group: 'operations',
    pages: [
      p('Overview', 'What the data team does, and how to get an answer from data.', [
        'What We Do',
        'Asking a Question',
      ]),
      p(
        'Metrics',
        'The numbers the company runs on, each defined once.',
        ['How a Metric Is Defined'],
        [
          p('Company Metrics', 'The handful of numbers leadership watches.', [
            'North Star',
            'Key Metrics',
          ]),
          p('Product Metrics', 'Activation, engagement and retention, defined.', [
            'Activation',
            'Engagement',
            'Retention',
          ]),
          p('Revenue Metrics', 'Bookings, recurring revenue and churn, defined.', [
            'Recurring Revenue',
            'Churn',
          ]),
        ],
      ),
      p(
        'Data Dictionary',
        'Every table and field, what it holds and where it comes from.',
        ['Tables', 'Fields'],
        [
          p('Sources', 'The systems data is collected from, and how often.', [
            'Source List',
            'Refresh Times',
          ]),
          p('Pipelines', 'How raw data becomes the tables people query.', [
            'Data Flow',
            'When a Pipeline Fails',
          ]),
        ],
      ),
      p('Dashboards', 'The dashboards there are, who owns each and what it answers.', [
        'Dashboard List',
        'Owners',
      ]),
      p('Analyses', 'Past analyses and what they found, so no question is answered twice.', [
        'Recent Analyses',
        'Writing One Up',
      ]),
      p('Data Quality', 'How data is checked, and what to do when a number looks wrong.', [
        'Checks',
        'Reporting a Problem',
      ]),
      p('Access and Privacy', 'Who can see which data, and the rules for personal data.', [
        'Getting Access',
        'Personal Data',
      ]),
      p('Tools', 'The query, notebook and dashboard tools, and how to start with each.', [
        'Querying',
        'Notebooks',
        'Dashboards',
      ]),
    ],
  },
  {
    id: 'meetings-decisions',
    name: 'Meetings and Decisions',
    line: 'Every meeting’s notes and every decision taken, with its reasons, so nothing has to be decided twice.',
    group: 'operations',
    pages: [
      p('How We Meet', 'Which meetings happen, what each is for and how they are run.', [
        'Regular Meetings',
        'Running a Good Meeting',
      ]),
      p(
        'Meeting Notes',
        'Notes from every meeting, newest first.',
        ['Taking Notes'],
        [
          p('Leadership Meetings', 'Notes from the leadership team’s meetings.', ['Latest']),
          p('Team Meetings', 'Notes from each team’s regular meetings.', ['Latest']),
          p('All-Hands', 'What was shared at each company meeting, and what people asked.', [
            'Latest',
            'Questions Asked',
          ]),
        ],
      ),
      p(
        'Decisions',
        'Every decision taken, why, and who took it.',
        ['Decision Log'],
        [
          p('How We Decide', 'Who decides what, and how to propose a decision.', [
            'Who Decides',
            'Proposing a Decision',
          ]),
          p(
            'Decision Records',
            'One page per significant decision: its context, the options and the choice.',
            ['Context', 'Options Considered', 'Decision', 'Consequences'],
          ),
          p('Reversed Decisions', 'Decisions since changed, and what changed them.', [
            'Changed Decisions',
          ]),
        ],
      ),
      p('Actions', 'What each meeting agreed to do, who is doing it and by when.', [
        'Open Actions',
        'Done',
      ]),
      p('Templates', 'The pages to copy for an agenda, meeting notes or a decision record.', [
        'Agenda',
        'Meeting Notes',
        'Decision Record',
      ]),
    ],
  },
];
