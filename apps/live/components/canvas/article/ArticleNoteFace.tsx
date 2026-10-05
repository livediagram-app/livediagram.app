'use client';

// A margin note's face (docs/specs/007-editor/article-pages.md "Comments and actions"): on its chip,
// a speech bubble holding the thread's open comment count (a dot before the first comment), or for
// an action a tick, filled once the action is done. Its own count, so no badge strip rides on it.
import { activeCommentCount, elementActions, type AnnotationElement } from '@livediagram/document';

export function ArticleNoteFace({ element }: { element: AnnotationElement }) {
  if (element.articleNote === 'action') {
    const actions = elementActions(element);
    const done = actions.length > 0 && actions.every((a) => a.status === 'done');
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 24 24" width="62%" height="62%" aria-hidden>
          <circle
            cx="12"
            cy="12"
            r="9"
            fill={done ? '#0ea5e9' : 'none'}
            stroke="#0284c7"
            strokeWidth={2}
          />
          <path
            d="m8 12.5 2.8 2.8L16.5 9.5"
            fill="none"
            stroke={done ? '#ffffff' : '#0284c7'}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }
  const count = activeCommentCount(element.commentThread);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 24 24" width="70%" height="70%" aria-hidden>
        <path
          d="M5 4.5h14A2.5 2.5 0 0 1 21.5 7v8a2.5 2.5 0 0 1-2.5 2.5h-8l-4.5 3.5v-3.5H5A2.5 2.5 0 0 1 2.5 15V7A2.5 2.5 0 0 1 5 4.5Z"
          fill="#f59e0b"
        />
        {count > 0 ? (
          <text
            x="12"
            y="11.4"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={count > 9 ? 7.5 : 9.5}
            fontWeight={700}
            fill="#ffffff"
            fontFamily="system-ui, sans-serif"
          >
            {count > 99 ? '99+' : count}
          </text>
        ) : (
          <circle cx="12" cy="11" r="1.8" fill="#ffffff" />
        )}
      </svg>
    </div>
  );
}
