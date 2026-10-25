'use client';

// The deleted state (@liveworkspace/workbench/components/chrome/TrashedCard), in this product's word:
// "This plan was deleted". Only the noun is this editor's; the card is the workbench's.
import {
  TrashedCard,
  type TrashedCardProps,
  type TrashedFile,
} from '@liveworkspace/workbench/components/chrome/TrashedCard';

// A plan in the Trash, as the index says: when it went, and why.
export type TrashedPlan = TrashedFile;

export function ProjectTrashedCard(props: Omit<TrashedCardProps, 'noun'>) {
  return <TrashedCard noun="plan" {...props} />;
}
