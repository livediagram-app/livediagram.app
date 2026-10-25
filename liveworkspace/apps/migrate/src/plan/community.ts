// Community (docs/migration.md, step 5): the old posts with their tags, likes, copies and open reports, each post
// pointing at the part that holds what was posted (the part its share link went to). Community serves only
// livediagram's and liveplanner's posts; a post whose content went to another app is reported and not carried.
import { copierHash, sha256Hex, siteOf } from '../ids.ts';
import type { PlanContext } from './context.ts';

type Row = Record<string, string | number | null>;

const COMMUNITY_APPS = new Set(['livediagram', 'liveplanner']);
const DEFAULT_COLOR = '#6366f1';

// An old like or copy from before the network hash was kept: one network per key, so it still counts once.
const networkOf = (hash: unknown, key: string): string =>
  typeof hash === 'string' && hash ? hash : sha256Hex(`migrated-network:${key}`);

export function writeCommunity(ctx: PlanContext): void {
  const posts = ctx.snapshot.prepare('SELECT * FROM community_posts ORDER BY published_at, id');
  const participant = ctx.snapshot.prepare(
    'SELECT name, color, picture_url FROM participants WHERE id = ?',
  );
  const tags = ctx.snapshot.prepare(
    'SELECT tag FROM community_post_tags WHERE post_id = ? ORDER BY tag',
  );
  const likes = ctx.snapshot.prepare(
    'SELECT * FROM community_likes WHERE post_id = ? ORDER BY liker_key',
  );
  const copies = ctx.snapshot.prepare(
    'SELECT * FROM community_copies WHERE post_id = ? ORDER BY copier_id',
  );
  const reports = ctx.snapshot.prepare(
    'SELECT * FROM community_reports WHERE post_id = ? ORDER BY reporter_key',
  );
  for (const p of posts.iterate() as Iterable<Row>) {
    const id = String(p.id);
    const docId = String(p.document_id);
    const kept = ctx.kept.get(docId);
    const code = String(p.share_code).toUpperCase();
    const target = ctx.linkTargets.get(code);
    if (!kept || !target) {
      ctx.report.skip(
        'community_post',
        id,
        kept ? 'its share link was not carried' : 'its document was not copied',
      );
      continue;
    }
    if (!COMMUNITY_APPS.has(target.app)) {
      ctx.report.skip(
        'community_post',
        id,
        `what was posted is in ${target.app}, which Community doesn't serve`,
      );
      continue;
    }
    const oldAuthor = String(p.author_id);
    const owner = ctx.owners.ownerOf(oldAuthor);
    const person = participant.get(oldAuthor) as Row | undefined;
    const name = String(person?.name ?? ctx.owners.account(owner)?.name ?? 'Someone');
    const color = String(person?.color ?? DEFAULT_COLOR);
    const updatedAt = Number(p.updated_at);
    const documentState = kept.trashed ? 'away' : kept.closed ? 'closed' : 'public';
    const hidden = p.state === 'hidden';
    ctx.sql.community.row({
      table: 'posts',
      key: id,
      columns: [
        'id',
        'app',
        'document',
        'share_code',
        'owner',
        'author_name',
        'author_color',
        'author_picture',
        'anonymous',
        'title',
        'description',
        'category',
        'tags',
        'search_text',
        'document_state',
        'like_count',
        'copy_count',
        'state',
        'hidden_at',
        'published_at',
        'updated_at',
      ],
      values: [
        id,
        siteOf(target.app),
        target.id,
        code,
        owner,
        name,
        color,
        person?.picture_url === null || person?.picture_url === undefined
          ? null
          : String(person.picture_url),
        Number(p.anonymous ?? 0) ? 1 : 0,
        String(p.title),
        String(p.description),
        String(p.category),
        String(p.tags ?? '[]'),
        String(p.search_text),
        documentState,
        Number(p.like_count),
        Number(p.copy_count),
        hidden ? 'hidden' : 'listed',
        hidden ? updatedAt : null,
        Number(p.published_at),
        updatedAt,
      ],
      conflict: ['id'],
      version: updatedAt,
      guard: 'updated_at',
      update: [
        'title',
        'description',
        'category',
        'tags',
        'search_text',
        'like_count',
        'copy_count',
        'state',
        'hidden_at',
        'updated_at',
      ],
    });
    ctx.report.add(`community.posts.${target.app}`);
    for (const t of tags.all(id) as Row[]) {
      ctx.sql.community.row({
        table: 'post_tags',
        key: `${id}|${String(t.tag)}`,
        columns: ['post_id', 'tag'],
        values: [id, String(t.tag)],
        conflict: ['post_id', 'tag'],
        version: 1,
      });
    }
    for (const l of likes.all(id) as Row[]) {
      const key = String(l.liker_key);
      ctx.sql.community.row({
        table: 'likes',
        key: `${id}|${key}`,
        columns: ['post_id', 'liker_key', 'network_hash', 'created_at'],
        values: [id, key, networkOf(l.network_hash, key), Number(l.created_at)],
        conflict: ['post_id', 'liker_key'],
        version: 1,
      });
    }
    for (const c of copies.all(id) as Row[]) {
      // The copier as Community names it: the one-way hash of the new owner, as livediagram's api sends it.
      const copier = copierHash(ctx.owners.ownerOf(String(c.copier_id)));
      ctx.sql.community.row({
        table: 'copies',
        key: `${id}|${copier}`,
        columns: ['post_id', 'copier', 'network_hash', 'created_at'],
        values: [id, copier, networkOf(c.network_hash, copier), Number(c.created_at)],
        conflict: ['post_id', 'copier'],
        version: 1,
      });
    }
    for (const r of reports.all(id) as Row[]) {
      const key = String(r.reporter_key);
      ctx.sql.community.row({
        table: 'reports',
        key: `${id}|${key}`,
        columns: ['post_id', 'reporter_key', 'network_hash', 'reason', 'note', 'created_at'],
        values: [
          id,
          key,
          String(r.network_hash),
          String(r.reason),
          r.note === null ? null : String(r.note),
          Number(r.created_at),
        ],
        conflict: ['post_id', 'reporter_key'],
        version: 1,
      });
    }
  }
}
