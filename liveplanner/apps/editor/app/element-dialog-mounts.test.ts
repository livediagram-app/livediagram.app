import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { elementDialogMountGaps } from '@liveworkspace/workbench/lib/element-dialog-mounts';

// Every open-for-id state the editor declares has its dialog mounted in components/dialogs/EditorElementDialogs.tsx.
it('mounts a dialog for every open-for-id state', () => {
  expect(elementDialogMountGaps(fileURLToPath(new URL('..', import.meta.url)))).toEqual([]);
});
