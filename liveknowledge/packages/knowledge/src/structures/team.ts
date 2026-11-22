// The Company structures (setup-structures.ts, docs/specs/030-knowledgebase/describe-to-set-up.md "The start
// screen"): how the company and its teams work, and how someone new finds their feet.
import { p, type SetupStructure } from './shape';

export const TEAM_STRUCTURES: readonly SetupStructure[] = [
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
];
