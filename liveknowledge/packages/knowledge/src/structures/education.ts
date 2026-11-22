// The Education structures (setup-structures.ts, docs/specs/030-knowledgebase/describe-to-set-up.md "The start
// screen"): courses, classes and training, for whoever teaches and whoever learns.
import { p, type SetupStructure } from './shape';

export const EDUCATION_STRUCTURES: readonly SetupStructure[] = [
  {
    id: 'course-handbook',
    name: 'Course Handbook',
    line: 'For a teacher running a course: the syllabus, each week’s lessons, the assignments and what students ask.',
    group: 'education',
    pages: [
      p('Welcome', 'What the course is about, and how it runs.', [
        'About This Course',
        'How to Use This Handbook',
      ]),
      p('Syllabus', 'What the course covers, and what students can do by the end of it.', [
        'Learning Outcomes',
        'Schedule',
        'Reading List',
      ]),
      p(
        'Lessons',
        'One page per week: what is taught, the materials and what follows.',
        ['How Each Week Works'],
        [
          p('Week 1', 'The first week: introductions, and the foundations the rest builds on.', [
            'Topics',
            'Materials',
            'Before Next Week',
          ]),
          p('Week 2', 'The second week’s topics and materials.', [
            'Topics',
            'Materials',
            'Before Next Week',
          ]),
          p('Week 3', 'The third week’s topics and materials.', [
            'Topics',
            'Materials',
            'Before Next Week',
          ]),
        ],
      ),
      p(
        'Assignments',
        'What students hand in, when and how it is marked.',
        ['Deadlines'],
        [
          p('Assignment Briefs', 'Each assignment, what it asks for and how it is judged.', [
            'The Brief',
            'Criteria',
          ]),
          p('Marking and Feedback', 'How work is marked, and when feedback comes back.', [
            'Marking Scheme',
            'Feedback',
          ]),
          p(
            'Late Work and Extensions',
            'What happens when work is late, and how to ask for more time.',
            ['Extensions', 'Penalties'],
          ),
        ],
      ),
      p('Resources', 'Readings, recordings and tools for the course.', [
        'Readings',
        'Recordings',
        'Tools',
      ]),
      p('Policies', 'Attendance, conduct and academic honesty.', [
        'Attendance',
        'Academic Honesty',
        'Use of AI',
      ]),
      p('Questions', 'The questions students ask most, answered once.', [
        'About the Course',
        'About Assignments',
      ]),
      p('Teaching Notes', 'For whoever teaches the course: what worked, and what to change.', [
        'What Worked',
        'Changes for Next Time',
      ]),
    ],
  },
  {
    id: 'study-notes',
    name: 'Study Notes',
    line: 'For a student: notes for every subject, the reading, revision plans and the deadlines that matter.',
    group: 'education',
    pages: [
      p('Overview', 'This term at a glance: subjects, timetable and deadlines.', [
        'Subjects',
        'Timetable',
        'Deadlines',
      ]),
      p(
        'Subjects',
        'One page per subject, with its notes kept under it.',
        ['How Notes Are Kept'],
        [
          p('Subject Template', 'The page to copy for a new subject.', [
            'About the Subject',
            'Key Ideas',
            'Questions',
          ]),
          p('Lecture Notes', 'Notes from each lecture or class, newest first.', [
            'Latest',
            'To Review',
          ]),
          p('Reading Notes', 'What each reading argues, and what to remember from it.', [
            'Summary',
            'Quotes',
            'My Thoughts',
          ]),
        ],
      ),
      p('Assignments', 'Every piece of work due, with its brief and a plan for it.', [
        'Due Soon',
        'Handed In',
      ]),
      p(
        'Revision',
        'Getting ready for exams.',
        [],
        [
          p('Revision Plan', 'What to revise, and when.', ['Schedule', 'Topics']),
          p('Past Papers', 'Past exam questions, and the answers worked through.', [
            'Questions',
            'Answers',
          ]),
          p('Flashcards', 'Key terms and facts to test yourself on.', ['Terms', 'Facts']),
        ],
      ),
      p('Study Methods', 'The ways of studying that work, and the habits to keep.', [
        'What Works',
        'Habits',
      ]),
      p('Resources', 'Useful books, sites and people to ask.', ['Books', 'Websites', 'People']),
    ],
  },
  {
    id: 'training-academy',
    name: 'Training Academy',
    line: 'For whoever runs learning at work: the courses on offer, the paths through them and how training is booked.',
    group: 'education',
    pages: [
      p('Welcome', 'What the academy offers, and how to start learning.', [
        'What We Offer',
        'Where to Start',
      ]),
      p(
        'Learning Paths',
        'Courses in order, for each role and level.',
        ['Choosing a Path'],
        [
          p('New Managers', 'What a first-time manager learns in their first year.', [
            'Courses',
            'Milestones',
          ]),
          p('Technical Skills', 'The technical courses, from beginner to expert.', [
            'Beginner',
            'Intermediate',
            'Advanced',
          ]),
          p('Leadership', 'Courses for senior leaders, and for those becoming one.', [
            'Courses',
            'Mentoring',
          ]),
        ],
      ),
      p(
        'Course Catalogue',
        'Every course, how long it takes and who it is for.',
        ['All Courses'],
        [
          p('Required Training', 'The training everyone must complete, and by when.', [
            'Courses',
            'Deadlines',
          ]),
          p('Course Template', 'The page to copy for a new course.', [
            'Who It Is For',
            'Outcomes',
            'Outline',
            'Length',
          ]),
        ],
      ),
      p('Booking and Budget', 'How to book a course, and the learning budget each person has.', [
        'Booking',
        'Learning Budget',
      ]),
      p(
        'Teaching',
        'For anyone who runs a session.',
        [],
        [
          p('Running a Session', 'Preparing, delivering and following up a session.', [
            'Preparing',
            'On the Day',
            'Follow-Up',
          ]),
          p('Becoming a Trainer', 'How someone becomes a trainer, and the support they get.', [
            'Applying',
            'Support',
          ]),
        ],
      ),
      p('Measuring Learning', 'How training is evaluated, and what it has changed.', [
        'Feedback',
        'Results',
      ]),
      p('Frequently Asked Questions', 'What people ask most about training.', [
        'Booking',
        'Certificates',
      ]),
    ],
  },
  {
    id: 'research-lab',
    name: 'Research Lab',
    line: 'For an academic lab or research group: its people, projects and methods, and how a paper reaches print.',
    group: 'education',
    pages: [
      p('Welcome', 'What the lab studies, and how a new member finds their feet.', [
        'Our Research',
        'New Members',
      ]),
      p('People', 'Who is in the lab, what each person works on and who to ask.', [
        'Members',
        'Alumni',
      ]),
      p(
        'Projects',
        'Each research project, its question and where it stands.',
        ['Active Projects'],
        [
          p('Project Template', 'The page to copy for a new project.', [
            'Question',
            'Methods',
            'Status',
            'Results',
          ]),
          p('Funding', 'The grants that fund the lab, with their deadlines and reports.', [
            'Current Grants',
            'Reporting',
          ]),
        ],
      ),
      p(
        'Methods',
        'How the lab does its work, written down once.',
        [],
        [
          p('Protocols', 'Step-by-step procedures, one page per protocol.', [
            'Protocol List',
            'Writing a Protocol',
          ]),
          p('Data Management', 'Where data is kept, how it is named and how it is backed up.', [
            'Storage',
            'Naming',
            'Backups',
          ]),
          p('Equipment', 'The equipment, how to book it and who trains people on it.', [
            'Booking',
            'Training',
          ]),
        ],
      ),
      p(
        'Publishing',
        'How a paper goes from first draft to print.',
        [],
        [
          p('Writing a Paper', 'Authorship, drafts and internal review.', [
            'Authorship',
            'Internal Review',
          ]),
          p('Submitted and Published', 'Papers under review, and papers in print.', [
            'Under Review',
            'Published',
          ]),
        ],
      ),
      p('Lab Meetings', 'When the lab meets, and the notes from each meeting.', [
        'Schedule',
        'Notes',
      ]),
      p('Safety and Ethics', 'Safety rules, ethics approvals and the training they need.', [
        'Safety',
        'Ethics Approval',
      ]),
      p('Reading List', 'The papers every member should know.', [
        'Essential Reading',
        'Recent Papers',
      ]),
    ],
  },
];
