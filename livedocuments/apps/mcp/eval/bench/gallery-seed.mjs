// Puts a task's pictures into one run's image gallery before the run (a task's `gallery`: the user has uploaded
// these). Each picture is uploaded to liveworkspace's local media service as livedocuments' api uploads one
// (liveworkspace/docs/media.md "The API": `POST /api/media/app/images?owner=`), so it lands in the run's account's
// gallery exactly as an upload would. MEDIA_URL and MEDIA_KEY are the api's own (its .dev.vars), or the environment's.
// Each run gets its own account, so its own copies: an image belongs to one owner.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// A PNG's size, from its IHDR chunk (bytes 16 to 23, big-endian).
export function pngSize(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x89504e47) throw new Error('not a PNG');
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

// A value from the environment, else from the api's .dev.vars.
function devVar(apiDir, name) {
  if (process.env[name]) return process.env[name];
  const file = join(apiDir, '.dev.vars');
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  return (
    line
      ?.slice(name.length + 1)
      .trim()
      .replace(/^"|"$/g, '') || undefined
  );
}

// Seeds each owner's `pictures` ([{ file, name }], files under fixtures/), all before a round starts, so none is
// uploaded while runs are talking to the server. Answers each owner's gallery as listed.
export async function seedGalleries(apiDir, wanted) {
  const media = (devVar(apiDir, 'MEDIA_URL') ?? 'http://localhost:8792/api/media').replace(
    /\/+$/,
    '',
  );
  const key = devVar(apiDir, 'MEDIA_KEY');
  if (!key)
    throw new Error("Seeding a gallery needs MEDIA_KEY (the api's .dev.vars, or the environment)");
  const out = new Map();
  for (const { owner, pictures } of wanted) {
    const seeded = new Array(pictures.length);
    // The last picture first, so newest first is the order given.
    for (let i = pictures.length - 1; i >= 0; i--) {
      const p = pictures[i];
      const bytes = readFileSync(join(HERE, 'fixtures', p.file));
      const { width, height } = pngSize(bytes);
      const res = await fetch(`${media}/app/images?owner=${encodeURIComponent(owner)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'X-Media-App': 'livedocuments',
          'Content-Type': 'image/png',
          'X-Image-Width': String(width),
          'X-Image-Height': String(height),
          'X-Image-Original-Name': encodeURIComponent(p.name),
          'X-Image-Sha256': createHash('sha256').update(bytes).digest('hex'),
        },
        body: bytes,
      });
      if (!res.ok) throw new Error(`Seeding ${p.file} failed: ${res.status} ${await res.text()}`);
      const { image } = await res.json();
      seeded[i] = { id: image.id, name: p.name, width, height };
      // A millisecond apart at least, so the gallery's order is the one given.
      await new Promise((r) => setTimeout(r, 2));
    }
    out.set(owner, seeded);
  }
  return out;
}
