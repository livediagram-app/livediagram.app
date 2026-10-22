// The CLI Commands stack (docs/specs/015-api/blueprints/cli.md CLI56): one chart per counted CLI verb, from CLI_COMMANDS.

import { CLI_COMMANDS } from '../cli-commands';
import type { Metric, MetricStack } from '../metric-series';

export const CLI_COMMAND_METRICS: readonly Metric[] = CLI_COMMANDS.map(
  ({ type, command, what }) => ({
    category: 'Cli',
    action: 'Used',
    type,
    title: `livediagram ${command}`,
    blurb: `${what.charAt(0).toUpperCase()}${what.slice(1)}.`,
  }),
);

export const CLI_COMMANDS_STACK: MetricStack = {
  stack: true,
  title: 'CLI Commands',
  blurb:
    'Agents and scripts running the livediagram command line, by command. Only commands that succeeded count.',
  members: [...CLI_COMMAND_METRICS],
};
