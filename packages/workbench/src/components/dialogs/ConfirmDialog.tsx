'use client';

import { ConfirmDialog as SharedConfirmDialog, type ConfirmDialogProps } from '@liveworkspace/ui';
import { useModalGuard } from '../../hooks/ui/useModalGuard';

export type { ConfirmDialogProps };

// The one confirm modal (@liveworkspace/ui, packages/ui/src/dialog/ConfirmDialog.tsx), registered with the editor's
// modal guard like every editor dialog (./Dialog), so the window-level shortcuts go quiet behind it.
export function ConfirmDialog(props: ConfirmDialogProps) {
  useModalGuard(props.open);
  return <SharedConfirmDialog {...props} />;
}
