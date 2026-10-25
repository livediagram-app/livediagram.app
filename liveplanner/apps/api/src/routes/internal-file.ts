// The import door (liveworkspace/docs/drive.md "Contracts > The apps"; docs/specs/015-api/api.md "Internal"): a new
// plan for `owner` from a `.liveplanner` file, the Drive mirror's Import as a copy. The file is read here
// (plan-room/project-file.ts readProjectFile: another kind or a malformed tab, card, type catalogue or Sheet refused,
// fresh tab ids with their links re-pointed as a copy's are, every store's caps), the index makes the item as the
// owner's personal plan in the folder named (with this app's key, as the owner), and the new plan's object writes it.
import { importItemAs, type ImportInput, type ImportResult } from '@liveworkspace/index-app';
import { planRoom } from '../plan-client';
import { readProjectFile } from '../plan-room/project-file';
import { INDEX_APP, indexFor } from '../index-service';
import { capStoredName } from '../names';
import type { Env } from '../types';

export function importProjectFileFor(env: Env, input: ImportInput): Promise<ImportResult> {
  return importItemAs(
    indexFor(env, { kind: 'delegate', personId: input.owner, teams: [] }),
    INDEX_APP,
    input,
    {
      read: (file) => readProjectFile(file),
      title: (name) => capStoredName(name, null, 'project') || 'Untitled',
      write: (id, content, name) =>
        planRoom(env, id).importFile({ ...content, name, ownerId: input.owner }),
    },
  );
}
