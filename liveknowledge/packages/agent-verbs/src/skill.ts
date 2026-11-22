// The agent skill file (docs/specs/015-api/cli.md "Help"): short frontmatter saying when to use the CLI, a body
// naming the starting commands and the guides.

import { GUIDE_TOPICS, GUIDE_TOPIC_NAMES } from './guides';

export const SKILL_NAME = 'liveknowledge';

// Token budgets (blueprint "Constants and configuration", CLI49): the frontmatter every agent pays for at start, the
// body it pays for once it opens the skill.
export const SKILL_FRONTMATTER_MAX_TOKENS = 80;
export const SKILL_BODY_MAX_TOKENS = 1500;

export const SKILL_DESCRIPTION =
  "Search, read and suggest edits to a team's knowledgebase with the liveknowledge CLI. Use to answer from the team's pages on liveknowledge.app, change a page, or when a message carries a [liveknowledge] line.";

export const SKILL_DIRECTORIES: readonly { path: string; agent: string }[] = [
  { path: '~/.claude/skills', agent: 'Claude Code, every project' },
  { path: './.claude/skills', agent: 'Claude Code, this project' },
  { path: './.agents/skills', agent: 'the open Agent Skills layout, this project' },
];

export function renderSkill(): string {
  return [
    '---',
    `name: ${SKILL_NAME}`,
    `description: ${SKILL_DESCRIPTION}`,
    '---',
    '',
    '# liveknowledge',
    '',
    'Sign in with LIVEKNOWLEDGE_TOKEN (an lwt_ API token), or `liveknowledge auth login`. The CLI never prompts.',
    '',
    'Start:',
    '',
    '- `liveknowledge document ls <query>`: find a knowledgebase',
    '- `liveknowledge context <kb>`: the pages every agent reads first, and what this credential may do',
    '- `liveknowledge search <kb> <words>`: passages, each with how far it can be trusted',
    '- `liveknowledge read <kb> <page>`: a page as Markdown',
    '- `liveknowledge suggest <kb> <page> --reason ... --old ... --new ...`: an edit for a person to accept',
    '- `liveknowledge gap <kb> <question>`: record what the knowledgebase could not answer',
    '',
    'Prefer verified pages; say so when a page is due a review or in conflict with another.',
    '',
    'Guides, each a command:',
    '',
    ...GUIDE_TOPIC_NAMES.map(
      (topic) => `- \`liveknowledge guide ${topic}\`: ${GUIDE_TOPICS[topic].summary}`,
    ),
    '',
    'A message carrying a `[liveknowledge]` line is a selection reference from a workbench: read `liveknowledge guide workbench` first.',
    '',
    'stdout is data and stderr is hints; --json gives JSON; exit 0 is done, 1 rejected, 2 usage,',
    '3 not found, 4 auth, 5 conflict, 6 rate limited, 7 network or server.',
    '',
  ].join('\n');
}
