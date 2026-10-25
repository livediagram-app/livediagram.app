// The old images into the media service (docs/migration.md, step 4.1): each `images` row under its old id, its
// owner through the owner map as the media service keys owners, app `livediagram.app`, and an R2 copy of its bytes
// under the same key. The media service holds one image per owner and bytes (images_owner_sha_idx): two old images
// that become the same owner's with the same bytes (a guest's and the account it was merged into) can't both go in;
// the first is kept and the other reported, as its references would show nothing.
import { LIVEDIAGRAM_MEDIA_APP, mediaOwnerOf } from '../ids.ts';
import type { PlanContext } from './context.ts';
import type { JsonArrayFile, R2Entry } from './files.ts';

type Row = Record<string, string | number | null>;

export function writeImages(ctx: PlanContext, r2: JsonArrayFile): void {
  const rows = ctx.snapshot.prepare('SELECT * FROM images ORDER BY created_at, id');
  const first = new Map<string, string>();
  for (const r of rows.iterate() as Iterable<Row>) {
    const id = String(r.id);
    const owner = mediaOwnerOf(ctx.owners.ownerOf(String(r.owner_id)));
    const sha = String(r.sha256);
    const kept = first.get(`${owner}|${sha}`);
    if (kept) {
      ctx.report.imageCollisions.push({ image: id, keptImage: kept, owner });
      ctx.report.add('images.collision');
      continue;
    }
    first.set(`${owner}|${sha}`, id);
    ctx.sql.media.row({
      table: 'images',
      key: id,
      columns: [
        'id',
        'owner',
        'app',
        'content_type',
        'byte_size',
        'width',
        'height',
        'sha256',
        'original_name',
        'created_at',
      ],
      values: [
        id,
        owner,
        LIVEDIAGRAM_MEDIA_APP,
        String(r.content_type),
        Number(r.byte_size),
        Number(r.width),
        Number(r.height),
        sha,
        r.original_name === null ? null : String(r.original_name),
        Number(r.created_at),
      ],
      conflict: ['id'],
      // An image's bytes never change, so it is only ever inserted.
      version: sha,
    });
    const version = JSON.stringify(sha);
    if (ctx.ledger.version('r2', 'objects', id) !== version) {
      r2.push({
        key: id,
        contentType: String(r.content_type),
        byteSize: Number(r.byte_size),
        sha256: sha,
        version,
      } satisfies R2Entry);
    }
    ctx.report.add('images');
  }
}
