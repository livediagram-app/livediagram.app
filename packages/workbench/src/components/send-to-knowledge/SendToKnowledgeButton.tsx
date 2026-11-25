'use client';

// Send to Knowledge Base on a selection's toolbar (liveworkspace/docs/specs/004-index/send-to-knowledge.md "Where it
// is"): right after Send to Plan, liveknowledge's logo. Shown only while the editor's host offers it (an app with a
// summariser, a session that may send). The selection is captured only when pressed: nothing is read while it rests.
import { BrandMark } from '@liveworkspace/brand';
import { HoverCard } from '@liveworkspace/ui';
import {
  canSendKnowledgeHere,
  sendToKnowledge,
  type KnowledgeCapture,
} from './send-to-knowledge-entry';

export function KnowledgeLogo({ size = 14 }: { size?: number }) {
  return (
    <BrandMark app="liveknowledge" className="shrink-0" style={{ width: size, height: size }} />
  );
}

export function SendToKnowledgeButton({
  capture,
  className,
}: {
  // The selection as the app captures it, read on press.
  capture: () => KnowledgeCapture | null;
  // The toolbar's own button classes.
  className: string;
}) {
  if (!canSendKnowledgeHere()) return null;
  return (
    <HoverCard
      title="Send to Knowledge Base"
      description="Write these up on a page in liveknowledge, with a picture and a link back."
    >
      <button
        type="button"
        onClick={() => sendToKnowledge(capture())}
        aria-label="Send selected items to a knowledge base"
        data-send-to-knowledge=""
        className={className}
      >
        <KnowledgeLogo />
      </button>
    </HoverCard>
  );
}
