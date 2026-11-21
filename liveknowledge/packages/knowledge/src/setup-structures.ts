// The knowledgebase structures a new knowledgebase's start offers (docs/specs/030-knowledgebase/describe-to-set-up.md
// "The start screen"): whole shapes of a knowledgebase, each a tree of titled pages with a line on what belongs on
// each and the headings its writing would sit under. A structure becomes a SetupSuggestion through the parser a
// model's reply goes through (parseSetupSuggestion), so a structure picked here and one the AI proposes are one
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
export type StructureGroup = 'team' | 'engineering' | 'product';

export type SetupStructure = {
  id: string;
  name: string;
  line: string;
  group: StructureGroup;
  pages: readonly StructurePage[];
};

export const STRUCTURE_GROUPS: readonly { id: StructureGroup; name: string; line: string }[] = [
  { id: 'team', name: 'Team', line: 'How a team works, and how someone new finds their feet.' },
  {
    id: 'engineering',
    name: 'Engineering',
    line: 'How the systems are built, shipped and kept running.',
  },
  {
    id: 'product',
    name: 'Product and Support',
    line: 'What the product does, for the people who use it and help them.',
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
    id: 'engineering-wiki',
    name: 'Engineering Wiki',
    line: 'How the systems fit together, how code is written and reviewed, and how it ships.',
    group: 'engineering',
    pages: [
      p('Overview', 'What engineering builds, and how this wiki is arranged.', [
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
    group: 'product',
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
