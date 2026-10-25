#!/usr/bin/env node
// The migrate command (README.md is the runbook):
//   migrate snapshot <export.sql> <out.sqlite>
//   migrate plan <snapshot> --clerk <users.csv> --accounts <existing-accounts.json> [--ledger <ledger.sqlite>]
//                [--oauth-kv <dump.json>] [--no-pictures] --out <bundle-dir>
//   migrate apply <bundle> --env staging|production --ledger <ledger.sqlite> [--dry-run] [--concurrency <n>]
//   migrate verify <bundle> --env staging|production [--out <verify.json>]
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { apply, defaultWrangler } from './apply.ts';
import { createPictureDrawer } from './pictures.ts';
import { plan } from './plan/index.ts';
import { fetchHttp, processRunner } from './run.ts';
import { openSnapshot, snapshot } from './snapshot.ts';
import type { Env } from './targets.ts';
import { bundleKeys, verify, verifyQueries, wranglerExecute } from './verify.ts';

const USAGE = `usage:
  migrate snapshot <export.sql> <out.sqlite>
  migrate plan <snapshot> --clerk <users.csv> --accounts <existing-accounts.json> [--ledger <ledger.sqlite>] [--oauth-kv <dump.json>] [--no-pictures] --out <bundle-dir>
  migrate apply <bundle> --env staging|production --ledger <ledger.sqlite> [--dry-run] [--concurrency <n>]
  migrate verify <bundle> --env staging|production [--out <verify.json>]`;

function fail(message: string): never {
  console.error(message);
  console.error(USAGE);
  process.exit(2);
}

function envOf(value: string | undefined): Env {
  if (value !== 'staging' && value !== 'production') fail('--env must be staging or production');
  return value;
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (command === 'snapshot') {
    const [exportPath, outPath] = rest;
    if (!exportPath || !outPath) fail('snapshot needs <export.sql> <out.sqlite>');
    const meta = await snapshot(exportPath, outPath);
    console.log(JSON.stringify(meta, null, 2));
    return;
  }
  if (command === 'plan') {
    const { values, positionals } = parseArgs({
      args: rest,
      allowPositionals: true,
      options: {
        clerk: { type: 'string' },
        accounts: { type: 'string' },
        ledger: { type: 'string' },
        'oauth-kv': { type: 'string' },
        'no-pictures': { type: 'boolean' },
        out: { type: 'string' },
      },
    });
    const [snapshotPath] = positionals;
    if (!snapshotPath || !values.clerk || !values.accounts || !values.out) {
      fail('plan needs <snapshot> --clerk --accounts --out');
    }
    const { db, meta } = openSnapshot(snapshotPath);
    try {
      const result = await plan({
        snapshot: db,
        snapshotMeta: {
          exportSha256: meta.exportSha256,
          level: meta.level,
          snapshotAt: meta.snapshotAt,
        },
        clerkCsv: readFileSync(values.clerk, 'utf8'),
        existingAccounts: readFileSync(values.accounts, 'utf8'),
        ledgerPath: values.ledger ?? null,
        oauthKvPath: values['oauth-kv'] ?? null,
        outDir: values.out,
        drawPicture: values['no-pictures'] ? null : createPictureDrawer(),
      });
      console.log(
        `bundle ${result.manifest.bundle} written to ${values.out} in ${Math.round(result.ms)} ms`,
      );
      console.log(JSON.stringify(result.report.counts, null, 2));
    } finally {
      db.close();
    }
    return;
  }
  if (command === 'apply') {
    const { values, positionals } = parseArgs({
      args: rest,
      allowPositionals: true,
      options: {
        env: { type: 'string' },
        ledger: { type: 'string' },
        'dry-run': { type: 'boolean' },
        concurrency: { type: 'string' },
      },
    });
    const [bundleDir] = positionals;
    if (!bundleDir || !values.ledger) fail('apply needs <bundle> --env --ledger');
    await apply({
      bundleDir,
      env: envOf(values.env),
      ledgerPath: values.ledger,
      dryRun: values['dry-run'] ?? false,
      runner: processRunner,
      http: fetchHttp,
      vars: process.env,
      wrangler: process.env.MIGRATE_WRANGLER
        ? process.env.MIGRATE_WRANGLER.split(' ')
        : defaultWrangler(),
      concurrency: values.concurrency ? Number(values.concurrency) : undefined,
    });
    return;
  }
  if (command === 'verify') {
    const { values, positionals } = parseArgs({
      args: rest,
      allowPositionals: true,
      options: { env: { type: 'string' }, out: { type: 'string' } },
    });
    const [bundleDir] = positionals;
    if (!bundleDir) fail('verify needs <bundle> --env');
    const env = envOf(values.env);
    const tables = await verify(
      verifyQueries(bundleKeys(bundleDir)),
      wranglerExecute({
        runner: processRunner,
        wrangler: process.env.MIGRATE_WRANGLER
          ? process.env.MIGRATE_WRANGLER.split(' ')
          : defaultWrangler(),
        env,
        vars: process.env,
      }),
    );
    const text = JSON.stringify(tables, null, 2);
    if (values.out) writeFileSync(values.out, `${text}\n`);
    console.log(text);
    if (tables.some((t) => t.missing > 0)) process.exitCode = 1;
    return;
  }
  fail(command ? `unknown command ${command}` : 'no command');
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
