'use client';

// Send to Plan in a walking reader (docs/specs/013-workspace/send-to-plan.md "What it sends"): a sticky or a text read
// large while walking has the button in the reader's footer, for anyone who may send (read on the Space is enough, so
// a Participant and a Viewer too). The reader closes as the picker opens, so the two never trap focus together. Once
// sent, its chip stands there instead, live, opening the card.
import type { ReactNode } from 'react';
import type { Element } from '@livehuddle/document';
import { Button } from '@livehuddle/ui';
import { useSends } from '@liveworkspace/workbench/components/send-to-plan/send-store';
import {
  canSendElements,
  sendElements,
  SendToPlanMenuIcon,
} from '@liveworkspace/workbench/components/send-to-plan/send-menu-item';
import { SentChip } from '@liveworkspace/workbench/components/send-to-plan/SentChip';

/**
 * The reader's footer for a piece that sends, or null for one that doesn't (or a session that may not send), so a
 * reader with nothing to offer keeps no empty action row.
 */
export function useReaderSendToPlan(element: Element, onClose: () => void): ReactNode {
  const sends = useSends(element.id, 'element');
  if (element.type !== 'sticky' && element.type !== 'text') return null;
  if (sends.length > 0)
    return (
      <div className="flex w-full justify-end">
        <SentChip sends={sends} className="max-w-64" />
      </div>
    );
  if (!canSendElements([element])) return null;
  return (
    <div className="flex w-full justify-end">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-send-to-plan=""
        onClick={() => {
          onClose();
          sendElements([element]);
        }}
      >
        <SendToPlanMenuIcon size={14} />
        Send to Plan
      </Button>
    </div>
  );
}
