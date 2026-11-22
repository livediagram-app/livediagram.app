// The Community structures (setup-structures.ts, docs/specs/030-knowledgebase/describe-to-set-up.md
// "The start screen"): work done with people outside the team, clients, contributors, members and guests.
import { p, type SetupStructure } from './shape';

export const COMMUNITY_STRUCTURES: readonly SetupStructure[] = [
  {
    id: 'client-projects',
    name: 'Client Projects',
    line: 'For an agency or consultancy: each client’s brief, the work in flight and how projects are won, run and handed over.',
    group: 'community',
    pages: [
      p('How We Work', 'How a project runs here, from the first call to the handover.', [
        'Our Process',
        'Roles',
      ]),
      p(
        'Winning Work',
        'How a lead becomes a signed project.',
        [],
        [
          p('Proposals', 'How a proposal is written, priced and sent.', [
            'Writing a Proposal',
            'Pricing',
          ]),
          p('Statements of Work', 'What every statement of work agrees before work starts.', [
            'Scope',
            'Timeline',
            'Sign-Off',
          ]),
        ],
      ),
      p(
        'Clients',
        'One page per client: who they are, what they want and who to talk to.',
        ['Client List'],
        [
          p('Client Template', 'The page to copy for a new client.', [
            'About the Client',
            'Contacts',
            'Goals',
            'Projects',
          ]),
          p(
            'Onboarding a Client',
            'The kick-off, the accounts to set up and the first fortnight.',
            ['Kick-Off', 'Access and Accounts'],
          ),
        ],
      ),
      p(
        'Projects',
        'The work in flight, one page per project.',
        ['Active Projects'],
        [
          p('Project Brief', 'What every project page starts with.', [
            'Goals',
            'Scope',
            'Deadlines',
            'Budget',
          ]),
          p('Status Reports', 'The weekly update each client receives.', [
            'This Week',
            'Risks',
            'Next Steps',
          ]),
          p('Change Requests', 'How a change to the scope is agreed and priced.', [
            'Raising a Change',
            'Approval',
          ]),
        ],
      ),
      p(
        'Delivery',
        'How work is reviewed, approved and handed over.',
        [],
        [
          p('Reviews and Approvals', 'How the client sees the work and signs it off.', [
            'Review Rounds',
            'Sign-Off',
          ]),
          p('Handover', 'What the client receives when a project ends.', [
            'Files and Access',
            'Support After Launch',
          ]),
        ],
      ),
      p('Time and Billing', 'Tracking hours, and invoicing clients for them.', [
        'Timesheets',
        'Invoicing',
      ]),
      p('Case Studies', 'Finished projects worth showing, and what they achieved.', [
        'Recent Work',
      ]),
    ],
  },
  {
    id: 'open-source',
    name: 'Open Source Project',
    line: 'For the maintainers and contributors of an open source project: how to use it, how to help and how it is run.',
    group: 'community',
    pages: [
      p('Introduction', 'What the project does, who it is for and where it is going.', [
        'What It Does',
        'Roadmap',
      ]),
      p(
        'Using the Project',
        'Installing it, and the first steps with it.',
        [],
        [
          p('Installation', 'Every way to install it, and what it needs.', [
            'Requirements',
            'Installing',
          ]),
          p('Getting Started', 'A first working example, and where to go next.', [
            'First Steps',
            'Next Steps',
          ]),
          p('Upgrading', 'Moving between versions, and what changes.', [
            'Upgrade Guides',
            'Breaking Changes',
          ]),
        ],
      ),
      p(
        'Contributing',
        'How anyone can help, from fixing a typo to adding a feature.',
        ['Ways to Help'],
        [
          p('Development Setup', 'Building and testing the project on your own machine.', [
            'Building',
            'Running the Tests',
          ]),
          p('Pull Requests', 'How a change is proposed, reviewed and merged.', [
            'Before You Open One',
            'Review',
          ]),
          p('Issues', 'Reporting a bug or asking for a feature, and how issues are triaged.', [
            'Reporting a Bug',
            'Triage',
            'Labels',
          ]),
        ],
      ),
      p(
        'Governance',
        'Who decides, and how.',
        [],
        [
          p('Maintainers', 'Who maintains the project, and how someone becomes one.', [
            'Current Maintainers',
            'Becoming a Maintainer',
          ]),
          p('Decision Making', 'How proposals are discussed and decided.', ['Proposals', 'Voting']),
          p('Code of Conduct', 'How everyone is expected to behave, and how to report a problem.', [
            'Our Standards',
            'Reporting',
          ]),
        ],
      ),
      p('Releases', 'How versions are numbered, cut and announced.', [
        'Versioning',
        'Cutting a Release',
        'Changelog',
      ]),
      p('Security', 'How to report a vulnerability, and how it is handled.', [
        'Reporting a Vulnerability',
        'Supported Versions',
      ]),
      p('Community', 'Where people talk about the project, and how to join in.', [
        'Chat and Forums',
        'Events',
      ]),
    ],
  },
  {
    id: 'community-nonprofit',
    name: 'Community and Nonprofit',
    line: 'For a charity, club or community group: its purpose, its volunteers and members, and how it raises and spends money.',
    group: 'community',
    pages: [
      p('About Us', 'What the organisation is for, and who it serves.', [
        'Our Mission',
        'Who We Serve',
      ]),
      p(
        'Governance',
        'How the organisation is run and held to account.',
        [],
        [
          p('Board and Trustees', 'Who sits on the board, and what they are responsible for.', [
            'Members',
            'Responsibilities',
          ]),
          p('Meetings and Minutes', 'When the board meets, and the minutes of each meeting.', [
            'Schedule',
            'Minutes',
          ]),
          p(
            'Policies',
            'Safeguarding, conflicts of interest and the other policies the organisation keeps.',
            ['Safeguarding', 'Conflicts of Interest'],
          ),
        ],
      ),
      p(
        'Volunteers',
        'How volunteers join, are looked after and are thanked.',
        ['Volunteer Roles'],
        [
          p('Joining', 'How someone signs up, and the checks before they start.', [
            'Signing Up',
            'Checks',
          ]),
          p('Volunteer Handbook', 'What every volunteer needs to know.', [
            'Expectations',
            'Health and Safety',
          ]),
        ],
      ),
      p('Members', 'Who belongs, what they get and how they join or renew.', [
        'Membership',
        'Renewals',
      ]),
      p(
        'Programmes',
        'The services and activities the organisation runs.',
        ['Current Programmes'],
        [
          p('Programme Template', 'The page to copy for a new programme.', [
            'Purpose',
            'Who It Helps',
            'How It Runs',
            'Results',
          ]),
        ],
      ),
      p(
        'Fundraising',
        'Where the money comes from.',
        [],
        [
          p('Grants', 'The grants applied for and held, with their deadlines and reports.', [
            'Applications',
            'Reporting',
          ]),
          p('Donations', 'How donations are received, thanked and recorded.', [
            'Giving',
            'Thanking Donors',
          ]),
          p('Fundraising Events', 'Each fundraising event, and how it is run.', [
            'Upcoming',
            'Running an Event',
          ]),
        ],
      ),
      p('Finances', 'The budget, the accounts and how spending is approved.', [
        'Budget',
        'Annual Accounts',
      ]),
      p(
        'Communications',
        'The newsletter, the social accounts and how to talk about the organisation.',
        ['Newsletter', 'Social', 'Key Messages'],
      ),
    ],
  },
  {
    id: 'event-planning',
    name: 'Event Planning',
    line: 'Everything an event needs in one place: the plan, the venue, the programme, the guests and what was learned.',
    group: 'community',
    pages: [
      p('Overview', 'What the event is, who it is for and what success looks like.', [
        'Purpose',
        'Key Dates',
        'Success',
      ]),
      p(
        'Planning',
        'The plan, from the first idea to the day itself.',
        [],
        [
          p('Timeline', 'Every milestone between now and the event.', ['Milestones', 'Countdown']),
          p('Budget', 'What the event costs, and what has been spent.', [
            'Estimate',
            'Actual Spend',
          ]),
          p('Team and Roles', 'Who is doing what, before and on the day.', [
            'Organisers',
            'On the Day',
          ]),
        ],
      ),
      p(
        'Venue and Logistics',
        'Where the event happens, and everything needed to run it.',
        [],
        [
          p('Venue', 'The venue, its rooms and its rules.', [
            'Address and Access',
            'Rooms',
            'Rules',
          ]),
          p('Suppliers', 'Catering, equipment and everyone else booked, with their contacts.', [
            'Bookings',
            'Contacts',
          ]),
          p('Travel and Accommodation', 'Getting people there, and where they stay.', [
            'Getting There',
            'Hotels',
          ]),
        ],
      ),
      p(
        'Programme',
        'What happens, when and where.',
        ['Schedule'],
        [
          p('Speakers', 'Who is speaking, their sessions and what they need.', [
            'Speaker List',
            'What Speakers Need',
          ]),
          p('Sessions', 'Each session, its room and its time.', ['Session List']),
        ],
      ),
      p(
        'Guests',
        'Invitations, registration and looking after people.',
        [],
        [
          p('Invitations', 'Who is invited, and how.', ['Guest List', 'Sending Invitations']),
          p('Registration', 'How people sign up, and the numbers so far.', [
            'Signing Up',
            'Numbers',
          ]),
          p('Accessibility', 'Making sure everyone can take part.', [
            'Access Needs',
            'Dietary Requirements',
          ]),
        ],
      ),
      p('Promotion', 'How the event is announced and shared.', ['Announcements', 'Social']),
      p('On the Day', 'The run sheet, the contacts and what to do if something goes wrong.', [
        'Run Sheet',
        'Emergency Contacts',
        'If Something Goes Wrong',
      ]),
      p('After the Event', 'Thanks, feedback and what to do differently next time.', [
        'Feedback',
        'Lessons Learned',
      ]),
    ],
  },
];
