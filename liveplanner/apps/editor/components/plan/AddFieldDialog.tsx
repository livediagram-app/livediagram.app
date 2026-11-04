'use client';

// Add Field's modal (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field): the shared Dialog over the type
// editor, with its own dim layer, holding NewFieldForm in the gallery frame's dialog look. 720 px wide and a steady
// height, so moving between categories and steps never resizes it; a sheet on a phone, shorter than the type editor's
// so the editor's top edge shows, dimmed, behind it. Escape is asked of the form first (a step back, a search
// cleared) and only then closes this modal; the type editor under it never hears it (the Dialog closes only the one
// on top). Every way out hands focus back to the Add Field that opened it.
import { useId, useRef, useState, type ComponentProps } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useEscape } from '@liveplanner/ui';
import { NewFieldForm } from './NewFieldForm';

const PANEL = '[data-dialog-panel]';

// Read once on opening: a touch screen opens on the panel, so no keyboard flies up over the list.
const finePointer = () => window.matchMedia?.('(pointer: coarse)').matches !== true;

// Whether this modal's panel is the one on top (the last open panel in the page, as the Dialog judges it).
function onTop(inside: HTMLElement | null): boolean {
  const panel = inside?.closest(PANEL);
  if (!panel) return false;
  const panels = panel.ownerDocument.querySelectorAll(PANEL);
  return panels[panels.length - 1] === panel;
}

type FormProps = Omit<
  ComponentProps<typeof NewFieldForm>,
  'escapeRef' | 'onCancel' | 'dialogTitleId' | 'autoFocusSearch'
>;

export function AddFieldDialog({ onClose, ...form }: FormProps & { onClose: () => void }) {
  const titleId = useId();
  const escape = useRef<(() => boolean) | null>(null);
  const inside = useRef<HTMLDivElement>(null);
  const [focusSearch] = useState(finePointer);
  // The Dialog's own Escape is off (it would close at once); this one asks the form first.
  useEscape(
    () => {
      if (onTop(inside.current) && !escape.current?.()) onClose();
    },
    { preventDefault: true },
  );
  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      size="3xl"
      phoneSheet
      closeOnEscape={false}
      className="h-[min(40rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] overflow-hidden sm:w-[min(60rem,calc(100vw-2rem))] max-sm:h-[80dvh]"
    >
      <div ref={inside} className="contents">
        <NewFieldForm
          {...form}
          escapeRef={escape}
          onCancel={onClose}
          dialogTitleId={titleId}
          autoFocusSearch={focusSearch}
        />
      </div>
    </Dialog>
  );
}
