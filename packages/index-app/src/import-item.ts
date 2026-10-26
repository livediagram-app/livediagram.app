// The import door's work every app shares (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps"): read the file, make
// the index's item as its owner's personal item in the folder named, then write the content into the new item's
// Durable Object. The app supplies the reading (its envelope parser, fresh ids, its limits) and the writing.
//
// The index's item comes first, as an app's own create does: a new item the index refuses (a folder that is not
// the owner's) leaves nothing behind. A write that fails after it takes the item away again, so nobody finds an
// empty one, and the error goes on to the door (503): the mirror asks again on its next pass.

import type { App, IndexClient } from '@liveworkspace/index-client';
import type { ImportInput, ImportResult } from './internal';

export type ImportRead<T> =
  { ok: true; content: T } | { ok: false; failure: 'invalid_file' | 'too_large' };

export type ImportSteps<T> = {
  // The file's text as the app's content, or why not. Pure: nothing is written yet.
  read: (file: string) => ImportRead<T>;
  // The item's name as the app stores it (its own cap), never empty.
  title: (name: string) => string;
  // The content into the new item's Durable Object, as `owner`'s.
  write: (id: string, content: T, title: string) => Promise<unknown>;
};

export async function importItemAs<T>(
  // The index as the owner, with the app's key (the index's delegated mode, no teams): null when this deployment
  // has no index.
  client: IndexClient | null,
  app: App,
  input: ImportInput,
  steps: ImportSteps<T>,
  newId: () => string = () => crypto.randomUUID(),
): Promise<ImportResult> {
  const read = steps.read(input.file);
  if (!read.ok) return { status: read.failure };
  if (!client) throw new Error('index_unavailable');
  const title = steps.title(input.name);
  const id = newId();
  await client.createItem({ id, app, title, folderId: input.folderId, source: 'import' });
  try {
    await steps.write(id, read.content, title);
  } catch (err) {
    console.error('[internal] import write failed', { id, error: String(err) });
    await client.deleteItem(id, { permanent: true, reason: 'empty' }).catch((undo: unknown) => {
      console.warn('[internal] import undo failed', { id, error: String(undo) });
    });
    throw err;
  }
  return { status: 'ok', id };
}
