// The agent skill file (docs/specs/015-api/cli.md "Help"): short frontmatter saying when to use the CLI, a body
// naming the starting commands and the guides.

import { GUIDE_TOPICS, GUIDE_TOPIC_NAMES } from './guides';

export const SKILL_NAME = 'livediagram';

export const SKILL_DESCRIPTION =
  'Read, build, edit and comment on livediagram documents from the terminal with the livediagram CLI. Use when asked to draw, change or check a diagram on livediagram.app.';

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
    '# livediagram',
    '',
    'Sign in with LIVEDIAGRAM_TOKEN (an lvd_ API token), or `livediagram auth login`. The CLI never prompts.',
    '',
    'Start:',
    '',
    '- `livediagram document ls <query>`: find a document',
    '- `livediagram tab view <doc>`: its first tab, as an outline',
    '- `livediagram edit <doc> -f -`: edit operations from stdin, as one changeset',
    '- `livediagram tab lint <doc>`: what is wrong with how it is drawn',
    '',
    'Guides, each a command:',
    '',
    ...GUIDE_TOPIC_NAMES.map(
      (topic) => `- \`livediagram guide ${topic}\`: ${GUIDE_TOPICS[topic].summary}`,
    ),
    '',
    'stdout is data and stderr is hints; --json gives JSON; exit 0 is done, 1 rejected, 2 usage,',
    '3 not found, 4 auth, 5 conflict, 6 rate limited, 7 network or server.',
    '',
  ].join('\n');
}
