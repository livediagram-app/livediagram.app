// Puts a task's pictures into one run's image gallery before the run (a task's `gallery`: the user has uploaded
// these). The local api is not reachable over HTTP inside the combined wrangler session, so the picture goes where an
// upload would put it: its bytes in the local R2 bucket under its id, its row in `images` for the run's owner
// (docs/specs/009-elements/images.md "Storage"). Each run gets its own ids: an image belongs to one owner.
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUCKET = 'livedesign-images';

// A PNG's size, from its IHDR chunk (bytes 16 to 23, big-endian).
export function pngSize(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x89504e47) throw new Error('not a PNG');
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function wrangler(apiDir, args) {
  const res = spawnSync(
    'corepack',
    ['pnpm', 'exec', 'wrangler', ...args, '--local', '--persist-to', '.wrangler/state'],
    {
      cwd: apiDir,
      encoding: 'utf8',
    },
  );
  if (res.status !== 0)
    throw new Error(`wrangler ${args.slice(0, 3).join(' ')} failed:\n${res.stderr || res.stdout}`);
}

const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;

// Seeds each owner's `pictures` ([{ file, name }], files under fixtures/), all before a round starts: the wrangler
// commands block, so none may run while runs are talking to the server. Answers each owner's gallery as listed.
export function seedGalleries(apiDir, wanted) {
  const now = Date.now();
  const rows = [];
  const out = new Map();
  for (const { owner, pictures } of wanted) {
    const seeded = pictures.map((p, i) => {
      const file = join(HERE, 'fixtures', p.file);
      const bytes = readFileSync(file);
      const { width, height } = pngSize(bytes);
      const id = randomUUID();
      wrangler(apiDir, [
        'r2',
        'object',
        'put',
        `${BUCKET}/${id}`,
        '--file',
        file,
        '--content-type',
        'image/png',
      ]);
      // A second apart, so newest first is the order given.
      const createdAt = now - i * 1000;
      const sha = createHash('sha256').update(bytes).digest('hex');
      rows.push(
        'insert into images(id,owner_id,content_type,byte_size,width,height,sha256,original_name,created_at) values(' +
          [
            sql(id),
            sql(owner),
            sql('image/png'),
            bytes.byteLength,
            width,
            height,
            sql(sha),
            sql(p.name),
            createdAt,
          ].join(',') +
          ');',
      );
      return { id, name: p.name, width, height };
    });
    out.set(owner, seeded);
  }
  if (rows.length) {
    const sqlFile = join(mkdtempSync(join(tmpdir(), 'ldbench-gallery-')), 'gallery.sql');
    writeFileSync(sqlFile, rows.join('\n'));
    wrangler(apiDir, ['d1', 'execute', 'DB', '--file', sqlFile]);
  }
  return out;
}
