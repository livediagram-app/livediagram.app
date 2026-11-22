// The knowledgebase tasks of the benchmark (docs/instructions/evaluate-mcp-output.md). Each prompt is what a user
// would type; `checks` judge what the run did from the prompt's own requirements (see checks.mjs). A run's
// connection holds the scopes a new one does, read and suggest, so a change to a page is a suggestion.
import { resultJson } from '@liveworkspace/mcp-kit/eval/mcp-client';
import {
  atLeast,
  called,
  contextFirst,
  linksOf,
  mentionsAll,
  pagesOf,
  pagesTitled,
  pagesUnder,
  replied,
} from '../checks.mjs';

// The knowledgebase the reading and editing tasks take for granted ("our Handbook"), made in the run's own library.
const HANDBOOK = {
  name: 'Handbook',
  pages: [
    {
      title: 'Deploys',
      markdown:
        '## When we deploy\n\nDeploys go out on Tuesdays after the morning standup, never on a Friday.\n\n' +
        '## Who decides\n\nThe on-call engineer decides whether a deploy goes ahead.',
    },
    {
      title: 'Rollbacks',
      parent: 'Deploys',
      markdown: 'Roll back a deploy with one command from the release channel: `release rollback`.',
    },
    { title: 'Holidays', markdown: 'Everyone takes the last week of December off.' },
  ],
};

async function handbook(client) {
  const made = resultJson(await client.call('create_document', HANDBOOK));
  return made?.id ? [made.id] : [];
}

const unchanged = ({ snap }) => ({
  pass:
    pagesOf(snap).length === HANDBOOK.pages.length &&
    /tuesdays/i.test(pagesTitled(snap, /^deploys$/i)[0]?.markdown ?? ''),
  detail: `${pagesOf(snap).length} pages`,
});

export default [
  {
    id: 'K1',
    level: 'easy',
    prompt:
      'Start a knowledgebase for our support team with pages on refunds, shipping times and escalation. Put shipping times and escalation under a page called Policies.',
    checks: [
      ['four pages or more', ({ snap }) => atLeast(4, pagesOf(snap).length, 'pages')],
      ['a Policies page', ({ snap }) => pagesTitled(snap, /^policies$/i).length === 1],
      [
        'shipping times and escalation under Policies',
        ({ snap }) => {
          const under = pagesUnder(snap, /^policies$/i).map((p) => p.title);
          return {
            pass: under.some((t) => /shipping/i.test(t)) && under.some((t) => /escalat/i.test(t)),
            detail: `under Policies: ${under.join(', ') || 'nothing'}`,
          };
        },
      ],
      [
        'refunds, shipping and escalation',
        ({ snap }) => mentionsAll(snap, [/refund/i, /shipping/i, /escalat/i]),
      ],
    ],
  },
  {
    id: 'K2',
    level: 'easy',
    setup: handbook,
    prompt: 'According to our Handbook, on which day do deploys go out, and who decides?',
    checks: [
      ['get_context first', ({ run }) => contextFirst(run)],
      [
        'searched or read the pages',
        ({ run }) => called(run, 'search_pages') || called(run, 'read_page'),
      ],
      ['says Tuesdays', ({ run }) => replied(run, /tuesday/i)],
      ['says the on-call engineer', ({ run }) => replied(run, /on[- ]call/i)],
      ['changed nothing', unchanged],
    ],
  },
  {
    id: 'K3',
    level: 'medium',
    setup: handbook,
    prompt:
      'Our Handbook says deploys go out on Tuesdays. We moved them to Mondays last month: please fix the Deploys page.',
    checks: [
      ['get_context first', ({ run }) => contextFirst(run)],
      ['suggested the edit', ({ run }) => called(run, 'suggest_edit')],
      [
        'no page written directly',
        ({ run, snap }) => ({ pass: !called(run, 'write_page') && unchanged({ snap }).pass }),
      ],
      ['says it waits for a person', ({ run }) => replied(run, /suggest|review|accept|approv/i)],
    ],
  },
  {
    id: 'K4',
    level: 'medium',
    setup: handbook,
    prompt: 'What is our parental leave policy? Check the Handbook.',
    checks: [
      ['searched the pages', ({ run }) => called(run, 'search_pages')],
      ['reported the gap', ({ run }) => called(run, 'report_gap')],
      [
        'says the Handbook does not cover it',
        ({ run }) => replied(run, /not|no |doesn|does not|missing|couldn/i),
      ],
      ['made no policy up', ({ run }) => !replied(run, /\b\d+\s+(weeks?|months?|days?)\b/i)],
      ['changed nothing', unchanged],
    ],
  },
  {
    id: 'K5',
    level: 'hard',
    setup: handbook,
    prompt:
      'Add a page on hotfixes to the Handbook, under Deploys: a hotfix can go out on any day with two approvals. Link it to the Rollbacks page.',
    checks: [
      ['a Hotfixes page', ({ snap }) => pagesTitled(snap, /hotfix/i).length === 1],
      [
        'under Deploys',
        ({ snap }) => pagesUnder(snap, /^deploys$/i).some((p) => /hotfix/i.test(p.title)),
      ],
      [
        'any day, two approvals',
        ({ snap }) => {
          const text = pagesTitled(snap, /hotfix/i)[0]?.markdown ?? '';
          return { pass: /any day/i.test(text) && /two approvals|2 approvals/i.test(text) };
        },
      ],
      [
        'links to Rollbacks',
        ({ snap }) =>
          linksOf(pagesTitled(snap, /hotfix/i)[0] ?? {}).some((t) => /rollbacks/i.test(t)),
      ],
      [
        'a draft, not verified',
        ({ snap }) => pagesTitled(snap, /hotfix/i)[0]?.verified === 'never-verified',
      ],
    ],
  },
];
