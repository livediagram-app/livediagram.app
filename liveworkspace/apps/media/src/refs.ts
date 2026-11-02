// The references (liveworkspace/docs/specs/006-media/media.md "References"): which images each app's documents place,
// as each app last reported. The app's documents stay the source of truth; this is what lets the service
// tell an image no app places any more.

import type { MediaApp } from '@liveworkspace/media';
import type { Env } from './env';

// Replace each listed document's references with the images it places now, all in one batch so a
// document is never half replaced. An empty list clears the document.
export async function syncRefs(
  env: Env,
  app: MediaApp,
  documents: { document: string; images: string[] }[],
  complete: boolean,
): Promise<void> {
  const db = env.MEDIA_DB;
  const statements: D1PreparedStatement[] = [];
  for (const { document, images } of documents) {
    const ids = JSON.stringify([...new Set(images)]);
    statements.push(
      db
        .prepare(
          `DELETE FROM refs WHERE app = ?1 AND document = ?2
             AND image_id NOT IN (SELECT value FROM json_each(?3))`,
        )
        .bind(app, document, ids),
      db
        .prepare(
          `INSERT OR IGNORE INTO refs (app, document, image_id)
           SELECT ?1, ?2, value FROM json_each(?3)`,
        )
        .bind(app, document, ids),
    );
  }
  if (complete) {
    statements.push(
      db
        .prepare(
          `INSERT INTO ref_sync (app, completed_at) VALUES (?, ?)
           ON CONFLICT (app) DO NOTHING`,
        )
        .bind(app, Date.now()),
    );
  }
  if (statements.length > 0) await db.batch(statements);
}

// An upload for a document (liveworkspace/docs/specs/006-media/media.md "Uploads"): that document places the image
// from now on, until its own report says otherwise. New or deduped alike, so a document that never reports never
// loses a picture it was uploaded for.
export async function claimRef(
  env: Env,
  app: MediaApp,
  document: string,
  imageId: string,
): Promise<void> {
  await env.MEDIA_DB.prepare(
    'INSERT OR IGNORE INTO refs (app, document, image_id) VALUES (?, ?, ?)',
  )
    .bind(app, document, imageId)
    .run();
}

// Which of these apps (the ones that can use the service) have not yet sent every document at least once. An
// unreported app reads as placing nothing, so the sweep keeps whatever that app could be placing.
export async function pendingApps(env: Env, apps: readonly MediaApp[]): Promise<MediaApp[]> {
  const { results } = await env.MEDIA_DB.prepare('SELECT app FROM ref_sync').all<{ app: string }>();
  const done = new Set(results.map((r) => r.app));
  return apps.filter((app) => !done.has(app));
}
