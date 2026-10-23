// The agent skill file (docs/specs/015-api/cli.md "Help"): short frontmatter saying when to use the CLI, a body
// naming the starting commands and the guides.

import { GUIDE_TOPICS, GUIDE_TOPIC_NAMES } from './guides';

export const SKILL_NAME = 'liveplanner';

// Token budgets (blueprint "Constants and configuration", CLI49): the frontmatter every agent pays for at start, the
// body it pays for once it opens the skill.
export const SKILL_FRONTMATTER_MAX_TOKENS = 80;
export const SKILL_BODY_MAX_TOKENS = 1500;

export const SKILL_DESCRIPTION =
  'Read, build and edit liveplanner plans with the liveplanner CLI. Use when asked to read or change a liveplanner.app board, sheet, dashboard or form, or when a message carries a [liveplanner] line.';

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
    '# liveplanner',
    '',
    'Sign in with LIVEPLANNER_TOKEN (an lwt_ API token), or `liveplanner auth login`. The CLI never prompts.',
    '',
    'Start:',
    '',
    '- `liveplanner project ls <query>`: find a plan',
    '- `liveplanner tab view <project>`: its first tab, as an outline',
    '- `liveplanner edit <project> -f -`: edit operations from stdin, as one changeset',
    '',
    'Guides, each a command:',
    '',
    ...GUIDE_TOPIC_NAMES.map(
      (topic) => `- \`liveplanner guide ${topic}\`: ${GUIDE_TOPICS[topic].summary}`,
    ),
    '',
    'A message carrying a `[liveplanner]` line is a selection reference from a workbench: read `liveplanner guide workbench` first.',
    '',
    'stdout is data and stderr is hints; --json gives JSON; exit 0 is done, 1 rejected, 2 usage,',
    '3 not found, 4 auth, 5 conflict, 6 rate limited, 7 network or server.',
    '',
  ].join('\n');
}
