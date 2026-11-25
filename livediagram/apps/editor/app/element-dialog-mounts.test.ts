import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { elementDialogMountGaps } from '@liveworkspace/workbench/lib/element-dialog-mounts';

// Every open-for-id state the editor declares has its dialog mounted in components/dialogs/EditorElementDialogs.tsx.
it('mounts a dialog for every open-for-id state', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  // Declared here, mounted by another file that gates itself.
  const elsewhere = {
    liveStatusOpenForId:
      'components/dialogs/LiveStatusDialogHost.tsx (mounted at the end of EditorElementDialogs)',
  };
  expect(elementDialogMountGaps(root, elsewhere)).toEqual([]);
});
