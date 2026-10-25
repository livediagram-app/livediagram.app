'use client';

// A margin note's face (docs/specs/007-editor/article-pages.md "Comments and actions"): told apart
// by more than colour. A comment is an indigo speech bubble holding the thread's open comment count
// (a dot before the first comment; an outlined bubble with a tick once resolved). An action is an
// emerald tick in a ring, the assignee's initials on its corner, turning to a solid disc once done
// (slate for Won't Do). Its own count, so no badge strip rides on it. The chip's outline (round
// for a comment, a rounded square for an action) is element-variant.ts's.
import type { ArticleNoteElement } from '@livedocuments/document';
import { GlyphDisc, IDENTITY_FILL, identityVars } from '@livedocuments/ui';
import { NOTE_INK, noteLook, type NoteAssignee } from '@/lib/article/article-note-look';

const BUBBLE =
  'M5 4.5h14A2.5 2.5 0 0 1 21.5 7v8a2.5 2.5 0 0 1-2.5 2.5h-8l-4.5 3.5v-3.5H5A2.5 2.5 0 0 1 2.5 15V7A2.5 2.5 0 0 1 5 4.5Z';

export function ArticleNoteFace({ element }: { element: ArticleNoteElement }) {
  const look = noteLook(element);
  return (
    <div
      data-note-face={look.face}
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {look.face === 'comment' || look.face === 'comment-resolved' ? (
        <CommentGlyph open={look.face === 'comment' ? look.open : null} />
      ) : (
        <ActionGlyph
          closed={
            look.face === 'action-done'
              ? NOTE_INK.action.ink
              : look.face === 'action-wont-do'
                ? NOTE_INK.wontDo
                : null
          }
        />
      )}
      {look.face === 'action-open' && look.assignee ? <AssigneeDisc who={look.assignee} /> : null}
    </div>
  );
}

// `open` null: the thread is resolved.
function CommentGlyph({ open }: { open: number | null }) {
  const { ink } = NOTE_INK.comment;
  if (open === null) {
    return (
      <svg viewBox="0 0 24 24" width="66%" height="66%" aria-hidden>
        <path d={BUBBLE} fill="none" stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
        <path
          d="m8.6 11.2 2.3 2.3 4.5-4.5"
          fill="none"
          stroke={ink}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="66%" height="66%" aria-hidden>
      <path d={BUBBLE} fill={ink} />
      {open > 0 ? (
        <text
          x="12"
          y="11.4"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={open > 9 ? 7.5 : 9.5}
          fontWeight={700}
          fill="#ffffff"
          fontFamily="system-ui, sans-serif"
        >
          {open > 99 ? '99+' : open}
        </text>
      ) : (
        <circle cx="12" cy="11" r="1.8" fill="#ffffff" />
      )}
    </svg>
  );
}

// `closed`: the solid disc's colour once done or Won't Do; null while open (a ring).
function ActionGlyph({ closed }: { closed: string | null }) {
  const { ink } = NOTE_INK.action;
  return (
    <svg viewBox="0 0 24 24" width="66%" height="66%" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r={closed ? 10 : 9}
        fill={closed ?? 'none'}
        stroke={closed ? 'none' : ink}
        strokeWidth={2}
      />
      <path
        d="m7.8 12.4 2.9 2.9 5.6-5.8"
        fill="none"
        stroke={closed ? '#ffffff' : ink}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Who an open action is for (D90): their initials in their colour on the chip's corner, its deep
// shade in dark mode as every identity disc (white text never sits on a raw runtime colour).
function AssigneeDisc({ who }: { who: NoteAssignee }) {
  return (
    <GlyphDisc
      size={14}
      data-note-assignee=""
      aria-hidden
      style={identityVars(who.color)}
      className={`absolute -right-1.5 -bottom-1.5 text-[6.5px] font-bold text-white ring-[1.5px] ring-white ${IDENTITY_FILL}`}
    >
      {who.initials}
    </GlyphDisc>
  );
}
