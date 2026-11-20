'use client';

// An answer as it streams (docs/specs/030-knowledgebase/blueprints/ask-ui.md "The conversation"): one text node the
// conversation appends to once a frame at most. React draws this once, when the answer starts, and not again until
// it ends: a token is `appendData` on that node, never a render. The text is text: nothing in it is read as markup.
import { useEffect, useRef } from 'react';
import type { AskConversation } from '@/lib/knowledge-ask/ask-conversation';

export function StreamingAnswer({
  conversation,
  turnId,
  onGrow,
}: {
  conversation: AskConversation;
  turnId: string;
  // After each frame's text is in: the conversation keeps its foot in view.
  onGrow?: (() => void) | undefined;
}) {
  const host = useRef<HTMLParagraphElement>(null);
  const waiting = useRef<HTMLSpanElement>(null);
  const grow = useRef(onGrow);
  useEffect(() => {
    grow.current = onGrow;
  });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const node = document.createTextNode('');
    el.append(node);
    const stop = conversation.watchStream(turnId, (text) => {
      // The first words take the waiting line's place.
      if (node.length === 0 && waiting.current) waiting.current.hidden = true;
      node.appendData(text);
      grow.current?.();
    });
    return () => {
      stop();
      node.remove();
    };
  }, [conversation, turnId]);
  return (
    <>
      {/* The words are not read out a token at a time: a screen reader hears the answer when it is whole. */}
      <p ref={host} aria-hidden data-ask-stream="" className="whitespace-pre-wrap break-words" />
      <span
        ref={waiting}
        role="status"
        className="text-sm text-slate-600 motion-safe:animate-pulse dark:text-slate-400"
      >
        Reading the pages…
      </span>
    </>
  );
}
