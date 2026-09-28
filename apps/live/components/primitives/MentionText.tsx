// A comment's text with its @-mentions drawn as chips (docs/specs/012-collaboration/comment-mentions.md
// "Reading a mention"). Only an `@handle` that matches one of the comment's
// stored mentions becomes a chip; any other `@word` stays plain text.

import type { CSSProperties } from 'react';
import { mentionSegments, type CommentMention } from '@livediagram/diagram';

export function MentionText({
  text,
  mentions,
  chipClassName = '',
  chipStyle,
}: {
  text: string;
  mentions?: readonly CommentMention[];
  // How a chip looks where it sits: the accent on a themed card, the brand
  // colour in the app's chrome.
  chipClassName?: string;
  chipStyle?: CSSProperties;
}) {
  return (
    <>
      {mentionSegments(text, mentions).map((seg, i) =>
        seg.mention ? (
          <span
            key={i}
            className={`rounded px-0.5 font-semibold ${chipClassName}`}
            style={chipStyle}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}
