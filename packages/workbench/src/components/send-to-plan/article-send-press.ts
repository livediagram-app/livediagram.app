'use client';

// An article page toolbar's Send to Plan and Send to Diagram (livedocuments' and liveknowledge's
// docs/specs/013-workspace/send-to-plan.md; liveworkspace/docs/specs/004-index/send-to-plan.md "On a touch screen"):
// the words a press on the toolbar started on, for the entry's click, since a tap may clear them before it lands.
import { useState } from 'react';
import type { ArticlePick } from './article-send-dom';
import { articleSendPick, type PMState } from './article-sent';
import { pressHold } from './press-hold';
import { canSendHere } from './send-to-plan-entry';

export function useArticleSendPress(read: () => PMState) {
  const [held] = useState(() => pressHold<ArticlePick | null>());
  return {
    // On the toolbar's pointerdown: nothing to read while this session cannot send.
    onPress: () => {
      if (canSendHere()) held.hold(articleSendPick(read()));
    },
    // The words to send: those the press held, else those the caret or selection is on now.
    pick: (): ArticlePick | null => held.take() ?? articleSendPick(read()),
  };
}
