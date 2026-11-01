// The import door (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps"; docs/specs/015-api/api.md "Internal"): a new
// canvas for `owner` from a `.livediagram` file, the Drive mirror's Import as a copy. The file is read here
// (document-room/document-file.ts readDocumentFile: another kind or a malformed tab refused, fresh tab ids with
// their links and the deck's slides re-pointed, the tab and deck caps), the index makes the item as the owner's
// personal canvas in the folder named (with this app's key, as the owner), and the new canvas's object writes it.
import { importItemAs, type ImportInput, type ImportResult } from '@liveworkspace/index-app';
import { documentRoom } from '../document-client';
import { readDocumentFile } from '../document-room/document-file';
import { INDEX_APP, indexFor } from '../index-service';
import { capStoredName } from '../names';
import type { Env } from '../types';

export function importDocumentFileFor(env: Env, input: ImportInput): Promise<ImportResult> {
  return importItemAs(
    indexFor(env, { kind: 'delegate', personId: input.owner, teams: [] }),
    INDEX_APP,
    input,
    {
      read: readDocumentFile,
      title: (name) => capStoredName(name, null, 'document') || 'Untitled',
      write: (id, content, name) =>
        documentRoom(env, id).importFile({ ...content, name, ownerId: input.owner }),
    },
  );
}
