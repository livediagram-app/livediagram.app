'use client';

// The deleted state (@liveworkspace/workbench/components/chrome/TrashedCard; docs/specs/013-workspace/trash.md "While a
// canvas is in the Trash"), in this product's word: "This canvas was deleted". An empty canvas says it waited
// EMPTY_DOCUMENT_STALE_DAYS (docs/specs/013-workspace/empty-document-cleanup.md "In the Trash"). Only the noun and the
// days are this editor's; the card is the workbench's (liveworkspace/docs/specs/022-interface-design/action-parity.md).
import { EMPTY_DOCUMENT_STALE_DAYS } from '@livediagram/api-schema';
import {
  TrashedCard,
  type TrashedCardProps,
} from '@liveworkspace/workbench/components/chrome/TrashedCard';

export function DocumentTrashedCard(props: Omit<TrashedCardProps, 'noun' | 'emptyDays'>) {
  return <TrashedCard noun="canvas" emptyDays={EMPTY_DOCUMENT_STALE_DAYS} {...props} />;
}
