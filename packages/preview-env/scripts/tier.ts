// Decides a PR's tier from turbo's package graph and its labels, and writes `tier`,
// `add_label` and `reason` to $GITHUB_OUTPUT and the step summary
// (docs/specs/016-platform/pr-previews.md "Choosing the tier").
//
//   node scripts/tier.ts --pr 123 --base <sha> --head <sha> --labels '["bug"]'

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { logLine } from '../src/log.ts';
import { parsePrNumber } from '../src/names.ts';
import { decideTier, parseTurboLs } from '../src/tier.ts';
import { flags, required } from './args.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SHA = /^[0-9a-f]{7,40}$/;

try {
  const args = flags(process.argv.slice(2));
  const pr = parsePrNumber(required(args, 'pr'));
  const base = required(args, 'base');
  const head = required(args, 'head');
  if (!SHA.test(base) || !SHA.test(head)) throw new Error('--base and --head must be commit SHAs');
  const labels = JSON.parse(required(args, 'labels')) as unknown;
  if (!Array.isArray(labels) || !labels.every((l) => typeof l === 'string')) {
    throw new Error('--labels must be a JSON array of label names');
  }

  const turbo = execFileSync(
    `${ROOT}node_modules/.bin/turbo`,
    ['ls', `--filter=...[${base}...${head}]`, '--output=json'],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const decision = decideTier({ affected: parseTurboLs(turbo), labels });
  const line = logLine('tier', {
    pr,
    tier: decision.tier,
    reason: decision.reason,
    add_label: decision.addLabel,
  });
  console.log(line);

  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    appendFileSync(
      output,
      `tier=${decision.tier}\nadd_label=${decision.addLabel}\nreason=${decision.reason}\n`,
    );
  }
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const why = {
      graph: 'it touches the api',
      label: 'it carries the label',
      none: 'it does not touch the api',
    };
    appendFileSync(
      summary,
      `PR #${pr} gets a **${decision.tier}** preview: ${why[decision.reason]}.\n`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
