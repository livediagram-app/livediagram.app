'use client';

import { useId, type ReactNode } from 'react';
import { Button } from '@liveworkspace/ui';
import { HeroDialogHeader, type HeroArt } from '@liveworkspace/ui/dialog-hero';
import { Dialog } from './Dialog';
import { DialogFooter } from './DialogFooter';

/** What of an element a dialog edits: a checklist's rows, a legend's, a chart's slices, an agenda's segments, a table's look. */
export type RowsEditorKind = 'checklist' | 'legend' | 'slices' | 'segments' | 'table' | 'web-rows';
export type RowsEditorOpen = { id: string; kind: RowsEditorKind };

// The dialog an element's rows are edited in (each product's docs/specs/008-canvas/canvas-and-palette.md "A
// category that opens a dialog"): a checklist's rows, a legend's, a chart's slices, an entity's fields. A centred
// card, a bottom sheet on a phone, under the dialog hero header. The rows inside save each change as it is made
// (leaving an input saves it; a tick, a remove and an add save at once), so there is nothing to cancel: Done
// closes, and undo takes any change back.
export function ElementRowsDialog({
  art,
  title,
  subtitle,
  onClose,
  size = 'md',
  children,
}: {
  // Wider for a dialog of settings laid out in two columns (a Sankey's Configure).
  size?: 'md' | '2xl';
  art: HeroArt;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  // A row still being typed saves when its input is left; closing by Escape, the backdrop or a swipe leaves it
  // first, so the last edit is never dropped.
  const close = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    onClose();
  };
  return (
    <Dialog open onClose={close} titleId={titleId} size={size} phoneSheet className="max-h-[85vh]">
      <HeroDialogHeader
        art={art}
        titleId={titleId}
        title={title}
        subtitle={subtitle}
        onClose={close}
        underHandle
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
      <DialogFooter>
        <Button variant="primary" onClick={close}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
