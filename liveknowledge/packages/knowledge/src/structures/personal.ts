// The Personal structures (setup-structures.ts, docs/specs/030-knowledgebase/describe-to-set-up.md "The start
// screen"): a knowledgebase of your own, its notes, plans and the things worth keeping.
import { p, type SetupStructure } from './shape';

export const PERSONAL_STRUCTURES: readonly SetupStructure[] = [
  {
    id: 'second-brain',
    name: 'Second Brain',
    line: 'Everything worth remembering in one place: ideas, notes on what you read, your projects and the areas of your life.',
    group: 'personal',
    pages: [
      p('Inbox', 'Quick notes to sort later, so nothing is lost.', ['To Sort']),
      p('Projects', 'What you are working on now, each with an outcome and an end.', [
        'Active',
        'Someday',
      ]),
      p(
        'Areas',
        'The parts of life that need looking after, with no end date.',
        [],
        [
          p('Work', 'Your role, your goals and what you are responsible for.', [
            'Responsibilities',
            'Goals',
          ]),
          p('Health', 'Exercise, sleep and appointments.', ['Habits', 'Appointments']),
          p('Money', 'Budgets, savings and the accounts you hold.', ['Budget', 'Savings']),
          p('Home', 'The household, its jobs and its contacts.', ['Jobs', 'Contacts']),
        ],
      ),
      p(
        'Resources',
        'Notes on the topics you care about, kept for reference.',
        ['Topics'],
        [
          p('Books', 'Notes on each book you read, and what to take from it.', [
            'Reading Now',
            'Finished',
            'Key Ideas',
          ]),
          p('Articles and Talks', 'Ideas worth keeping from what you read and watch.', [
            'Saved',
            'Highlights',
          ]),
          p('Ideas', 'Thoughts to come back to.', ['New Ideas', 'Developing']),
        ],
      ),
      p('Journal', 'Daily or weekly notes on what happened and what you think of it.', [
        'Daily Notes',
        'Weekly Review',
      ]),
      p('Archive', 'Finished projects, and notes no longer in use.', [
        'Finished Projects',
        'Old Notes',
      ]),
    ],
  },
  {
    id: 'job-search',
    name: 'Job Search',
    line: 'For a job hunt: what you want, the roles you apply for, every interview and the stories to tell in them.',
    group: 'personal',
    pages: [
      p(
        'What I Am Looking For',
        'The role, the company and the terms you want, and the ones you will not take.',
        ['Roles', 'Must Haves', 'Deal Breakers'],
      ),
      p(
        'My Story',
        'What you bring, told well.',
        [],
        [
          p('Experience', 'Each role you have held, and what you achieved in it.', [
            'Roles',
            'Achievements',
          ]),
          p(
            'Interview Stories',
            'Examples ready to tell: a challenge, a disagreement, a success.',
            ['Situation', 'Action', 'Result'],
          ),
          p('Pitch', 'Who you are, in a minute.', ['The Short Version', 'The Long Version']),
        ],
      ),
      p(
        'Applications',
        'Every role applied for, and where each one stands.',
        ['Applied', 'Interviewing', 'Offers', 'Closed'],
        [
          p('Application Template', 'The page to copy for each new application.', [
            'The Role',
            'Why Me',
            'Contacts',
            'Timeline',
          ]),
        ],
      ),
      p('Companies', 'Companies worth working for, and what you know about each.', [
        'Target List',
        'Research',
      ]),
      p(
        'Interviews',
        'Getting ready for each interview, and what you learned after it.',
        [],
        [
          p('Preparation', 'Common questions, questions to ask and what to research first.', [
            'Common Questions',
            'Questions to Ask',
          ]),
          p('Interview Notes', 'Notes from each interview, written straight after.', [
            'How It Went',
            'Follow-Up',
          ]),
        ],
      ),
      p('Networking', 'People who can help, and when you last spoke.', ['Contacts', 'Follow-Ups']),
      p('Offers', 'Comparing offers, and negotiating the one you want.', [
        'Comparison',
        'Negotiation',
      ]),
    ],
  },
  {
    id: 'recipe-book',
    name: 'Recipe Book',
    line: 'Your recipes in one place, sorted by meal, with the meal plans, the shopping list and notes from the kitchen.',
    group: 'personal',
    pages: [
      p('Start Here', 'How the recipes are arranged, and how to add one.', [
        'How It Works',
        'Adding a Recipe',
      ]),
      p(
        'Recipes',
        'Every recipe, by the meal it is for.',
        ['Favourites'],
        [
          p('Breakfast', 'Mornings, quick and slow.', ['Quick', 'Weekend']),
          p('Lunch', 'Lunches to make ahead or eat at home.', ['Make Ahead', 'At Home']),
          p('Dinner', 'Main meals for every night of the week.', [
            'Weeknight',
            'Special Occasions',
          ]),
          p('Baking', 'Breads, cakes and biscuits.', ['Bread', 'Cakes', 'Biscuits']),
          p('Desserts', 'Puddings, warm and cold.', ['Warm', 'Cold']),
        ],
      ),
      p('Recipe Template', 'The page to copy for a new recipe.', [
        'Ingredients',
        'Method',
        'Notes',
      ]),
      p('Meal Plans', 'What to cook each week.', ['This Week', 'Next Week']),
      p('Shopping List', 'What to buy, by aisle.', ['Fresh', 'Store Cupboard', 'Frozen']),
      p('Kitchen Notes', 'Techniques, substitutions and conversions worth remembering.', [
        'Techniques',
        'Substitutions',
        'Conversions',
      ]),
      p('To Try', 'Recipes found but not yet cooked.', ['Found', 'Tried']),
    ],
  },
  {
    id: 'home-manual',
    name: 'Home Manual',
    line: 'Everything about running a home: the bills, the appliances, the contacts and what to do when something breaks.',
    group: 'personal',
    pages: [
      p('Overview', 'The home at a glance, and what everyone in it should know.', [
        'Key Information',
        'Who Lives Here',
      ]),
      p(
        'Household',
        'The everyday running of the home.',
        [],
        [
          p('Bills and Accounts', 'Every bill, its account and when it is paid.', [
            'Utilities',
            'Insurance',
            'Subscriptions',
          ]),
          p('Chores', 'Who does what, and how often.', ['Weekly', 'Monthly']),
          p('Calendar', 'Bin days, renewals and the dates not to miss.', [
            'Regular Dates',
            'Renewals',
          ]),
        ],
      ),
      p(
        'Around the House',
        'How things work, room by room.',
        [],
        [
          p('Appliances', 'Each appliance, its manual and its warranty.', [
            'Appliance List',
            'Warranties',
          ]),
          p('Heating and Water', 'The boiler, the thermostat and where the stopcock is.', [
            'Boiler',
            'Stopcock',
          ]),
          p('Garden', 'The plants, the jobs for each season and the tools.', [
            'Seasonal Jobs',
            'Plants',
          ]),
        ],
      ),
      p('Maintenance', 'Regular jobs and repairs, done and planned.', [
        'Regular Jobs',
        'Repairs Done',
      ]),
      p('Contacts', 'Trades, neighbours and services to call.', [
        'Trades',
        'Neighbours',
        'Emergency',
      ]),
      p('Emergencies', 'What to do in a leak, a power cut or a fire, and where everything is.', [
        'Leak',
        'Power Cut',
        'Fire',
      ]),
      p('Guests', 'What a guest or a house sitter needs to know.', [
        'Wi-Fi',
        'House Rules',
        'Pets',
      ]),
      p('Paperwork', 'Where the deeds, policies and guarantees are kept.', [
        'Where Things Are',
        'Renewal Dates',
      ]),
    ],
  },
];
