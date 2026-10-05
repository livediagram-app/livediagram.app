'use client';

import { Dialog as DialogShell, type DialogProps } from '@livediagram/ui';
import { useModalGuard } from '@/hooks/ui/useModalGuard';

// The editor's dialog: the shared shell (@livediagram/ui) registered with the modal guard, so the editor's
// window-level shortcut and paste listeners go quiet while any dialog is up (they otherwise mutate the canvas
// behind the modal; see lib/modal-guard).
export function Dialog(props: DialogProps) {
  useModalGuard(props.open);
  return <DialogShell {...props} />;
}
