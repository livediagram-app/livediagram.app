import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LOCATION,
  PLACEHOLDER_ID,
  ensureDatabase,
  findDatabase,
  main,
  pinId,
} from './ensure-d1.mjs';

const PINNED = '56f5a8c6-523c-40d7-a16d-c92e88064d44';
const MADE = '11111111-2222-4333-8444-555555555555';

// Production's block holds the placeholder; staging's is pinned.
const CONFIG = `name = "svc"

[[d1_databases]]
binding = "SVC_DB"
database_name = "svc"
database_id = "${PLACEHOLDER_ID}"
migrations_dir = "migrations"

[[ratelimits]]
name = "LIMIT"
namespace_id = "1111"

[env.staging]
name = "svc-staging"

[[env.staging.d1_databases]]
binding = "SVC_DB"
database_name = "svc-staging"
database_id = "${PINNED}"
`;

// A fake wrangler: answers `d1 list` with `databases`, `d1 create` with wrangler's snippet.
function fakeWrangler({ databases = [], listStatus = 0, createStatus = 0, createOut } = {}) {
  const calls = [];
  const wrangler = (args) => {
    calls.push(args.join(' '));
    if (args[1] === 'list') return { status: listStatus, stdout: JSON.stringify(databases) };
    return {
      status: createStatus,
      stdout:
        createOut ??
        `✅ Successfully created DB\n{\n  "d1_databases": [\n    {\n      "database_id": "${MADE}"\n    }\n  ]\n}\n`,
    };
  };
  return { wrangler, calls };
}

test('each environment reads its own block', () => {
  assert.deepEqual(findDatabase(CONFIG, 'SVC_DB', 'production'), {
    name: 'svc',
    id: PLACEHOLDER_ID,
    binding: 'SVC_DB',
    idLine: 5,
  });
  assert.equal(findDatabase(CONFIG, 'SVC_DB', 'staging').id, PINNED);
  assert.equal(findDatabase(CONFIG, 'OTHER', 'production'), null);
});

test('a pinned id asks Cloudflare nothing', () => {
  const { wrangler, calls } = fakeWrangler();
  const result = ensureDatabase({
    binding: 'SVC_DB',
    environment: 'staging',
    config: CONFIG,
    wrangler,
  });
  assert.deepEqual(result, { ok: true, id: PINNED, created: false });
  assert.deepEqual(calls, []);
});

test('a placeholder finds the database by name when it exists', () => {
  const { wrangler, calls } = fakeWrangler({
    databases: [
      { name: 'svc-other', uuid: MADE },
      { name: 'svc', uuid: PINNED },
    ],
  });
  const result = ensureDatabase({
    binding: 'SVC_DB',
    environment: 'production',
    config: CONFIG,
    wrangler,
  });
  assert.deepEqual(result, { ok: true, id: PINNED, created: false, name: 'svc', line: 5 });
  assert.deepEqual(calls, ['d1 list --json']);
});

test('a placeholder creates a missing database in Western Europe', () => {
  const { wrangler, calls } = fakeWrangler({ databases: [{ name: 'svc-staging', uuid: PINNED }] });
  const result = ensureDatabase({
    binding: 'SVC_DB',
    environment: 'production',
    config: CONFIG,
    wrangler,
  });
  assert.deepEqual(result, { ok: true, id: MADE, created: true, name: 'svc', line: 5 });
  assert.deepEqual(calls, ['d1 list --json', `d1 create svc --location ${LOCATION}`]);
});

test('every failure says what went wrong and pins nothing', () => {
  const run = (config, fake, environment = 'production') =>
    ensureDatabase({
      binding: 'SVC_DB',
      environment,
      config,
      wrangler: fakeWrangler(fake).wrangler,
    });
  assert.match(
    run('name = "x"\n', {}).message,
    /no \[\[d1_databases\]\] block with binding SVC_DB/,
  );
  const noId = CONFIG.replace(`database_id = "${PLACEHOLDER_ID}"\n`, '');
  assert.match(run(noId, {}).message, /no database_id line/);
  assert.match(run(CONFIG, { listStatus: 1 }).message, /d1 list failed/);
  assert.equal(
    ensureDatabase({
      binding: 'SVC_DB',
      environment: 'production',
      config: CONFIG,
      wrangler: () => ({ status: 0, stdout: 'not json' }),
    }).ok,
    false,
  );
  assert.match(run(CONFIG, { createStatus: 1 }).message, /d1 create svc failed/);
  assert.match(run(CONFIG, { createOut: 'created, no id' }).message, /could not read its id/);
});

test('pinning changes only the id line', () => {
  const pinned = pinId(CONFIG, 5, MADE);
  assert.equal(
    pinned,
    CONFIG.replace(`database_id = "${PLACEHOLDER_ID}"`, `database_id = "${MADE}"`),
  );
});

test('main pins a found or created id in the checkout only, and says to pin it in the repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ensure-d1-'));
  const file = join(dir, 'wrangler.toml');
  const placeholder = CONFIG.replace(PINNED, PLACEHOLDER_ID);
  writeFileSync(file, placeholder);
  const logged = [];
  const created = main(['SVC_DB', '--env', 'staging'], {
    cwd: dir,
    log: (l) => logged.push(l),
    wrangler: fakeWrangler().wrangler,
  });
  assert.equal(created, 0);
  assert.equal(readFileSync(file, 'utf8'), CONFIG.replace(PINNED, MADE));
  assert.deepEqual(logged, [
    `::notice title=Pin svc-staging::Created D1 svc-staging (${MADE}). Put this id in its wrangler.toml in place of the placeholder.`,
  ]);

  // Found by name: production's block, the default environment.
  writeFileSync(file, placeholder);
  const found = [];
  const fake = fakeWrangler({ databases: [{ name: 'svc', uuid: PINNED }] });
  assert.equal(
    main(['SVC_DB'], { cwd: dir, log: (l) => found.push(l), wrangler: fake.wrangler }),
    0,
  );
  assert.match(found[0], /^::notice title=Pin svc::Found D1 svc/);

  // A failure is an error annotation and leaves the file as it was.
  writeFileSync(file, placeholder);
  const failed = [];
  const broken = fakeWrangler({ listStatus: 1 }).wrangler;
  assert.equal(main(['SVC_DB'], { cwd: dir, log: (l) => failed.push(l), wrangler: broken }), 1);
  assert.deepEqual(failed, ['::error title=D1 database::wrangler d1 list failed']);
  assert.equal(readFileSync(file, 'utf8'), placeholder);

  // A pinned id: nothing asked, nothing logged, the file unchanged. No binding: usage.
  writeFileSync(file, CONFIG);
  const quiet = [];
  const untouched = fakeWrangler();
  assert.equal(
    main(['SVC_DB', '--env', 'staging'], {
      cwd: dir,
      log: (l) => quiet.push(l),
      wrangler: untouched.wrangler,
    }),
    0,
  );
  assert.deepEqual([quiet, untouched.calls], [[], []]);
  assert.equal(readFileSync(file, 'utf8'), CONFIG);
  assert.equal(main([], { cwd: dir, log: () => {} }), 2);
});
