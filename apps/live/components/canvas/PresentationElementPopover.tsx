'use client';

// What one element has to say, shown during a presentation (spec/31).
//
// The rule the whole mode runs on is READ ANYTHING, CHANGE NOTHING. Clicking
// an element mid-presentation opens this: its note, its comment thread, and
// its assigned actions. Nothing here is editable and there is no composer, so
// a presenter can show the room the objection somebody left on the box they
// are pointing at, and cannot answer it from the projector.
//
// This is a different thing from the HUD's notes popover, and they never
// overlap: the HUD's carries the SLIDE's presenter note (what you mean to
// say), this one carries the ELEMENT's (what the diagram records about it).
//
// It reuses CommentPanelFace rather than growing a third rendering of a
// comment thread. That component already takes its handlers optionally, for
// exactly this case: a surface with no comment session renders the thread
// readable and inert. Presenting is a caller that omits them.

import { activeCommentCount, isBoxed, type BoxedElement, type Element } from '@livediagram/diagram';

import { CommentPanelFace } from '@/components/canvas/CommentPanelFace';
import { NoteRichText } from '@/components/notes/NoteRichText';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {title}
      </span>
      {children}
    </div>
  );
}

/**
 * Does this element carry anything worth opening a popover for?
 *
 * Arrows are excluded because they carry none of the three fields: a note, a
 * comment thread and an assigned action all live on boxed elements. Clicking
 * an arrow mid-presentation therefore falls through to advancing the slide,
 * which is the right outcome rather than an empty card.
 */
export function hasReadableDetail(element: Element): element is BoxedElement {
  if (!isBoxed(element)) return false;
  if (element.note?.trim()) return true;
  if (activeCommentCount(element.commentThread) > 0) return true;
  return element.action !== undefined;
}

export function PresentationElementPopover({
  element,
  at,
  onClose,
}: {
  element: BoxedElement;
  /** Viewport coordinates to anchor to — where the element was clicked. */
  at: { x: number; y: number };
  onClose: () => void;
}) {
  const note = element.note?.trim();
  const comments = activeCommentCount(element.commentThread);
  // One assigned action per element (spec/68), not a list.
  const action = element.action;

  // Clamped so a click near an edge still opens a fully visible card.
  const width = 320;
  const left = Math.min(Math.max(12, at.x - width / 2), window.innerWidth - width - 12);
  const top = Math.min(at.y + 16, window.innerHeight - 260);

  return (
    <div
      role="dialog"
      aria-label={`Details for ${element.label?.trim() || 'this element'}`}
      // Stops the surface's click-to-advance underneath: reading a note must
      // never cost you a slide.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto fixed z-[70] flex max-h-[60vh] w-80 flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      style={{ left, top }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
          {element.label?.trim() || 'Element'}
        </span>
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="shrink-0 cursor-pointer rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      </div>

      {note ? (
        <Section title="Note">
          <div className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
            {/* The same renderer the note popover uses, so formatting made
                in the editor survives onto the projector (spec/92). */}
            <NoteRichText note={element.note} noteRich={element.noteRich} />
          </div>
        </Section>
      ) : null}

      {comments > 0 ? (
        <Section title={comments === 1 ? '1 comment' : `${comments} comments`}>
          {/* No handlers: no composer, no resolve, no delete. */}
          <div className="relative min-h-[4rem] rounded-md bg-slate-50 dark:bg-slate-800/60">
            <CommentPanelFace element={element as never} textColor="inherit" selfId="" />
          </div>
        </Section>
      ) : null}

      {action ? (
        <Section title="Action">
          <div className="flex flex-col">
            <span className="flex items-baseline gap-1.5">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  action.status === 'done' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span
                className={`min-w-0 flex-1 text-[11px] font-medium ${
                  action.status === 'done'
                    ? 'text-slate-400 line-through dark:text-slate-500'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {action.name}
              </span>
            </span>
            {action.description ? (
              <span className="pl-3 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                {action.description}
              </span>
            ) : null}
            <span className="pl-3 text-[10px] text-slate-400 dark:text-slate-500">
              {action.assignee.name ?? 'Teammate'} · {action.status === 'done' ? 'Done' : 'Open'}
            </span>
          </div>
        </Section>
      ) : null}
    </div>
  );
}
