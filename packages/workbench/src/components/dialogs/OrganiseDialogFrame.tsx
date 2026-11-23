'use client';

// The tab menu's organise modals' frame (each product's docs/specs/006-*/tab-folders.md "Membership UX", and Add to
// Another File where a product has it): a centred dialog, the dialog hero header (liveworkspace/docs/specs/004-index/
// dialog-hero-header.md: the dialog's art, its title, a line under it, the close) over a scrolling body, the same in
// every editor.
import { useId, type ReactNode } from 'react';
import { useEscape } from '@liveworkspace/ui';
import { HeroDialogHeader, type HeroArt } from '@liveworkspace/ui/dialog-hero';
import { Dialog } from './Dialog';

export function OrganiseDialogFrame({
  art,
  title,
  sub,
  onClose,
  escapeHeld = false,
  children,
}: {
  art: HeroArt;
  title: string;
  sub: string;
  onClose: () => void;
  // Something inside holds Escape (a popover, an inline editor): it takes the press, and the dialog stays.
  escapeHeld?: boolean;
  children: ReactNode;
}) {
  // Capture-phase Esc so this wins over the editor's global shortcuts; the Dialog shell's own (bubble-phase) Esc is
  // suppressed via closeOnEscape.
  const titleId = useId();
  useEscape(onClose, { capture: true, stopPropagation: true, enabled: !escapeHeld });
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={title}
      size="lg"
      closeOnEscape={false}
      className="max-h-[80vh]"
    >
      <HeroDialogHeader
        art={art}
        titleId={titleId}
        title={title}
        subtitle={sub}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </Dialog>
  );
}
