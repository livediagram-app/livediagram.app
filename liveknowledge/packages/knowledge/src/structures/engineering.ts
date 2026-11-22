// The Engineering structures (setup-structures.ts, docs/specs/030-knowledgebase/describe-to-set-up.md "The start
// screen"): how the systems are built, shipped and kept running.
import { p, type SetupStructure } from './shape';

export const ENGINEERING_STRUCTURES: readonly SetupStructure[] = [
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
];
