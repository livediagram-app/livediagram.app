// The Customers structures (setup-structures.ts, docs/specs/030-knowledgebase/describe-to-set-up.md "The start
// screen"): how customers are reached, won, helped and kept.
import { p, type SetupStructure } from './shape';

export const CUSTOMER_STRUCTURES: readonly SetupStructure[] = [
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
