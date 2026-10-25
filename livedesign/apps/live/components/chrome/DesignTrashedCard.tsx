'use client';

// The deleted state (@liveworkspace/workbench/components/chrome/TrashedCard), in this product's word:
// "This design was deleted". Only the noun is this editor's; the card is the workbench's.
import {
  TrashedCard,
  type TrashedCardProps,
  type TrashedFile,
} from '@liveworkspace/workbench/components/chrome/TrashedCard';

// A design in the Trash, as the index says: when it went, and why.
export type TrashedDesign = TrashedFile;

export function DesignTrashedCard(props: Omit<TrashedCardProps, 'noun'>) {
  return <TrashedCard noun="design" {...props} />;
}
