// The agent skill file (docs/specs/015-api/cli.md "Help"): short frontmatter saying when to use the CLI, a body
// naming the starting commands and the guides.

import { GUIDE_TOPICS, GUIDE_TOPIC_NAMES } from './guides';

export const SKILL_NAME = 'livedocuments';

// Token budgets (blueprint "Constants and configuration", CLI49): the frontmatter every agent pays for at start, the
// body it pays for once it opens the skill.
export const SKILL_FRONTMATTER_MAX_TOKENS = 80;
export const SKILL_BODY_MAX_TOKENS = 1500;

export const SKILL_DESCRIPTION =
  'Read, build, edit and comment on livedocuments documents with the livedocuments CLI. Use when asked to draw, change or check a diagram on livedocuments.app, or when a message carries a [livedocuments] line.';

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
    '# livedocuments',
    '',
    'Sign in with LIVEDOCUMENTS_TOKEN (an lvd_ API token), or `livedocuments auth login`. The CLI never prompts.',
    '',
    'Start:',
    '',
    '- `livedocuments document ls <query>`: find a document',
    '- `livedocuments tab view <doc>`: its first tab, as an outline',
    '- `livedocuments edit <doc> -f -`: edit operations from stdin, as one changeset',
    '- `livedocuments tab lint <doc>`: what is wrong with how it is drawn',
    '',
    'Guides, each a command:',
    '',
    ...GUIDE_TOPIC_NAMES.map(
      (topic) => `- \`livedocuments guide ${topic}\`: ${GUIDE_TOPICS[topic].summary}`,
    ),
    '',
    'A message carrying a `[livedocuments]` line is a selection reference from a workbench: read `livedocuments guide workbench` first.',
    '',
    'stdout is data and stderr is hints; --json gives JSON; exit 0 is done, 1 rejected, 2 usage,',
    '3 not found, 4 auth, 5 conflict, 6 rate limited, 7 network or server.',
    '',
  ].join('\n');
}
