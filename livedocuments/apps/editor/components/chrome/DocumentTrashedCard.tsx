'use client';

// The deleted state (@liveworkspace/workbench/components/chrome/TrashedCard; docs/specs/013-workspace/trash.md), in
// this product's word: "This document was deleted". Only the noun is this editor's; the card is the workbench's
// (liveworkspace/docs/specs/022-interface-design/action-parity.md).
import {
  TrashedCard,
  type TrashedCardProps,
  type TrashedFile,
} from '@liveworkspace/workbench/components/chrome/TrashedCard';

// A document in the Trash, as the index says: when it went, and why (deleted, or empty for too long).
export type TrashedDocument = TrashedFile;

export function DocumentTrashedCard(props: Omit<TrashedCardProps, 'noun'>) {
  return <TrashedCard noun="document" {...props} />;
}
