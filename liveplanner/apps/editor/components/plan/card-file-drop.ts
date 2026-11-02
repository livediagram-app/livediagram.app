'use client';

// A file dropped on a board's card joins its Attachments (docs/specs/026-plan/items.md "Attachments"), when its type
// offers them and this person may edit cards: the card rings in the brand colour while a file is over it, and a
// refusal (too big, the card full) is said in a toast. Any other card takes no drop.
import { useState, type DragEvent } from 'react';
import { ITEM_TYPES, typeIn, type Item } from '@liveplanner/items';
import { usePlan } from './PlanContext';
import { imageFilesOf, useAttachmentUpload } from './use-attachment-upload';

export type CardFileDrop = {
  over: boolean;
  uploading: boolean;
  handlers: {
    onDragOver?: (e: DragEvent<HTMLElement>) => void;
    onDragLeave?: (e: DragEvent<HTMLElement>) => void;
    onDrop?: (e: DragEvent<HTMLElement>) => void;
  };
};

const NO_HANDLERS: CardFileDrop['handlers'] = {};

export function useCardFileDrop(item: Item, faceDown: boolean): CardFileDrop {
  const plan = usePlan();
  const type = typeIn(plan?.types ?? ITEM_TYPES, item.type);
  const takes = !faceDown && !!plan?.canEditCards && type.fields.includes('attachments');
  const upload = useAttachmentUpload(item.id, takes, { watchOffline: false });
  const [over, setOver] = useState(false);
  const uploading = upload.uploading > 0;
  if (!upload.canAdd) return { over: false, uploading, handlers: NO_HANDLERS };
  return {
    over,
    uploading,
    handlers: {
      onDragOver: (e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        if (!over) setOver(true);
      },
      onDragLeave: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      },
      onDrop: (e) => {
        setOver(false);
        const files = imageFilesOf(e.dataTransfer.files);
        if (files.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        void upload.add(files).then((failure) => {
          if (failure) plan?.notify?.(failure);
        });
      },
    },
  };
}
