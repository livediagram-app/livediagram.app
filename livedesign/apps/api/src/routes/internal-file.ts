// The import door (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps"; docs/specs/015-api/api.md "Internal"): a new
// design for `owner` from a `.livedesign` file, the Drive mirror's Import as a copy. The file is read here
// (design-room/design-file.ts readDesignFile: another kind or a malformed tab refused, fresh tab ids with their links
// and the deck's slides re-pointed, the tab and deck caps), the index makes the item as the owner's personal design
// in the folder named (with this app's key, as the owner), and the new design's object writes it.
import { importItemAs, type ImportInput, type ImportResult } from '@liveworkspace/index-app';
import { designRoom } from '../design-client';
import { readDesignFile } from '../design-room/design-file';
import { INDEX_APP, indexFor } from '../index-service';
import { capStoredName } from '../names';
import type { Env } from '../types';

export function importDesignFileFor(env: Env, input: ImportInput): Promise<ImportResult> {
  return importItemAs(
    indexFor(env, { kind: 'delegate', personId: input.owner, teams: [] }),
    INDEX_APP,
    input,
    {
      read: readDesignFile,
      title: (name) => capStoredName(name, null, 'design') || 'Untitled',
      write: (id, content, name) =>
        designRoom(env, id).importFile({ ...content, name, ownerId: input.owner }),
    },
  );
}
