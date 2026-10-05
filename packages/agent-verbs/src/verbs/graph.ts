// `graph lint` (docs/specs/024-agents/diagram-lint.md, docs/specs/015-api/blueprints/cli.md "Previews"): a graph or
// Mermaid file laid out and linted locally, before anything is written; `--compare` lays it out in each variant and
// prints one line of measures each. Nothing reaches the api.

import { z } from 'zod';
import { graphFromMermaid, type GraphInput } from '@livediagram/document';
import {
  compareGraphLayouts,
  type LintLogger,
  formatCompareTable,
  formatLintReport,
  lintGraph,
  parseCompareDimensions,
} from '@livediagram/diagram-lint';
import { graphBodyIssue } from '@livediagram/edit-operations';
import { defineVerb, VerbRefusal } from '../define';
import { classifySource } from '../source-kind';

const refuse = (message: string, hint = 'livediagram guide build') =>
  new VerbRefusal({ status: 400, code: 'invalid_value', message, hint });

// The graph a file holds: graph JSON (bare or as a replace), or Mermaid.
export function graphOfSource(text: string, named: string): GraphInput {
  const source = classifySource(text);
  const replace = source.kind === 'unknown' ? null : source.body.replace;
  if (replace?.mermaid !== undefined) {
    const parsed = graphFromMermaid(replace.mermaid);
    if (!parsed.ok) throw refuse(`${named}: ${parsed.error}`);
    return parsed.graph;
  }
  if (replace?.graph === undefined) throw refuse(`${named} holds no graph or Mermaid`);
  const issue = graphBodyIssue(replace.graph);
  if (issue) throw refuse(`${named}: ${issue}`);
  return replace.graph as GraphInput;
}

// The lint of a graph file's text, or its comparison across layout variants. `log` takes the lint's own lines
// (`[lint] run`), which must not reach the output: the CLI sends them to its debug channel.
export function graphLint(
  text: string,
  named: string,
  compare: string | undefined,
  log: (line: string) => void,
): { text: string; errors: number } {
  const lintLog: LintLogger = (fingerprint, fields) =>
    log(`${fingerprint} ${JSON.stringify(fields)}`);
  const graph = graphOfSource(text, named);
  if (compare === undefined) {
    const { report } = lintGraph(graph, { log: lintLog });
    return { text: formatLintReport(report), errors: report.counts.error };
  }
  const dims = parseCompareDimensions(compare);
  if ('error' in dims) throw refuse(dims.error, 'livediagram graph lint --help');
  return {
    text: formatCompareTable(compareGraphLayouts(graph, dims, { log: lintLog })),
    errors: 0,
  };
}

export const graphLintVerb = defineVerb({
  id: 'graph.lint',
  summary: 'Lint a graph or Mermaid file before writing it',
  description:
    'Lays a graph or Mermaid file out as the api would and prints its lint; --compare direction,groups,lines prints one line of measures per layout variant. Exits 1 when a finding is an error. Nothing is sent.',
  behaviour: 'read',
  local: true,
  offline: true,
  input: z.object({
    file: z.string().describe('The graph or Mermaid file, or - for stdin'),
    compare: z.string().optional().describe('Variants to compare: direction, groups, lines'),
  }),
  output: z.object({ text: z.string(), errors: z.number() }),
  text: ({ text }) => [text],
  exitCode: ({ errors }) => (errors > 0 ? 1 : 0),
  cli: {
    positionals: ['file'],
    examples: [
      'livediagram graph lint arch.json',
      'livediagram graph lint arch.json --compare direction,groups',
    ],
    prints: 'the lint summary and findings, or one line per variant',
  },
});
