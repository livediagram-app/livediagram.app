// The Product and Research structures (setup-structures.ts, docs/specs/030-knowledgebase/describe-to-set-up.md "The start
// screen"): what the product does, what is learned about its users and how projects run.
import { p, type SetupStructure } from './shape';

export const PRODUCT_STRUCTURES: readonly SetupStructure[] = [
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
];
