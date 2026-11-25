'use client';

// The deleted state (@liveworkspace/workbench/components/chrome/TrashedCard; docs/specs/013-workspace/trash.md), in
// this product's word: "This space was deleted". An empty space says it waited EMPTY_DOCUMENT_STALE_DAYS
// (docs/specs/013-workspace/empty-document-cleanup.md "In the Trash"). Only the noun and the days are this editor's;
// the card is the workbench's (liveworkspace/docs/specs/022-interface-design/action-parity.md).
import { EMPTY_DOCUMENT_STALE_DAYS } from '@livehuddle/api-schema';
import {
  TrashedCard,
  type TrashedCardProps,
} from '@liveworkspace/workbench/components/chrome/TrashedCard';

export function DocumentTrashedCard(props: Omit<TrashedCardProps, 'noun' | 'emptyDays'>) {
  return <TrashedCard noun="space" emptyDays={EMPTY_DOCUMENT_STALE_DAYS} {...props} />;
}
