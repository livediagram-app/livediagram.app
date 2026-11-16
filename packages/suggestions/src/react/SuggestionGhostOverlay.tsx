'use client';

// The ghosts suggestions draw over a canvas (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md "Seeing a
// suggestion"; blueprint "Presentation and UX"), in canvas space above the elements and below the selection chrome,
// each in its author's colour:
//   - an element put in: a dashed box where it would land, softly tinted, holding its words;
//   - an element changed: a dashed box where it would end up, with a dotted outline where it is now and a line
//     between them when it moves;
//   - an element taken out: its box struck with a hatch.
// Each ghost carries a chip naming its author (a dot in their colour on the canvas's own surface, so the words keep
// their contrast whatever the colour). The change this person is gathering draws the same way in their colour. While
// the review list points at one suggestion, the others step back. Supplementary to the review list, which names
// every suggestion, so hidden from assistive technology; nothing here takes a pointer.
import type { CSSProperties } from 'react';
import { ghostsOf, type SuggestionGhost } from '../plan';
import type { SuggestionElement } from '../suggestion';
import { suggestionOpsBetween } from '../plan';
import { useSuggestionsView } from './suggestions-store';

export type Box = { x: number; y: number; width: number; height: number };

const OUTSET = 3;
const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

const sameBox = (a: Box, b: Box) =>
  Math.abs(a.x - b.x) < 0.5 &&
  Math.abs(a.y - b.y) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;

/** The words most elements show: their label, else their text. */
export function elementWords(element: SuggestionElement): string | null {
  const e = element as { label?: unknown; text?: unknown };
  const words = typeof e.label === 'string' ? e.label : typeof e.text === 'string' ? e.text : '';
  return words.trim() ? words : null;
}

const GLYPH: Record<SuggestionGhost<SuggestionElement>['kind'], string> = {
  add: '+',
  update: '✎',
  remove: '−',
};

export function SuggestionGhostOverlay<E extends SuggestionElement>({
  elements,
  tabId,
  boundsOf,
  textOf = elementWords,
}: {
  elements: E[];
  tabId: string;
  // The product's element bounds, in canvas space.
  boundsOf: (element: E, elements: E[]) => Box;
  // The words an element shows, for an added or changed ghost to hold; null for none.
  textOf?: (element: E) => string | null;
}) {
  const view = useSuggestionsView();
  if (view.tabId !== tabId) return null;
  const suggestions = view.suggestions as unknown as Parameters<typeof ghostsOf<E>>[1];
  const ghosts = ghostsOf<E>(elements, suggestions);
  const draft =
    view.draft && view.draft.tabId === tabId && view.self
      ? ghostsOf<E>(elements, [
          {
            id: 'draft',
            tabId,
            author: view.self,
            createdAt: 0,
            ops: suggestionOpsBetween(view.draft.before as E[], view.draft.after as E[]),
            base: {},
          },
        ])
      : [];
  if (ghosts.length === 0 && draft.length === 0) return null;
  // Where an added element lands is read against the canvas as the suggestion would leave it.
  const withAdds = [
    ...elements,
    ...ghosts.flatMap((g) => (g.kind === 'add' && g.after ? [g.after] : [])),
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" data-suggestion-ghosts="">
      {[...ghosts, ...draft].map((g, i) => (
        <Ghost
          key={`${g.suggestionId}:${g.id}:${i}`}
          ghost={g}
          draft={g.suggestionId === 'draft'}
          dimmed={view.focused !== null && view.focused !== g.suggestionId}
          boundsOf={(el) => boundsOf(el, withAdds)}
          textOf={textOf}
        />
      ))}
    </div>
  );
}

function Ghost<E extends SuggestionElement>({
  ghost,
  draft,
  dimmed,
  boundsOf,
  textOf,
}: {
  ghost: SuggestionGhost<E>;
  draft: boolean;
  dimmed: boolean;
  boundsOf: (el: E) => Box;
  textOf?: (element: E) => string | null;
}) {
  const color = ghost.color;
  const after = ghost.after ? boundsOf(ghost.after) : null;
  const before = ghost.before ? boundsOf(ghost.before) : null;
  const shown = (after ?? before)!;
  const moved = after && before && !sameBox(after, before);
  const words = ghost.after && textOf ? textOf(ghost.after) : null;
  const frame = (box: Box): CSSProperties => ({
    left: box.x - OUTSET,
    top: box.y - OUTSET,
    width: box.width + OUTSET * 2,
    height: box.height + OUTSET * 2,
  });
  return (
    <div
      data-suggestion-ghost={ghost.kind}
      data-suggestion-id={ghost.suggestionId}
      className="transition-opacity duration-micro"
      style={{ opacity: dimmed ? 0.3 : 1 }}
    >
      {moved ? (
        <>
          <div
            className="absolute rounded-md"
            style={{ ...frame(before), border: `1.5px dotted ${tint(color, 70)}` }}
          />
          <svg
            className="absolute overflow-visible"
            style={{ left: 0, top: 0, width: 1, height: 1 }}
          >
            <line
              x1={before.x + before.width / 2}
              y1={before.y + before.height / 2}
              x2={after.x + after.width / 2}
              y2={after.y + after.height / 2}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              opacity={0.7}
            />
          </svg>
        </>
      ) : null}
      <div
        className="absolute flex items-center justify-center overflow-hidden rounded-md"
        style={{
          ...frame(shown),
          border: `2px ${ghost.kind === 'remove' ? 'solid' : 'dashed'} ${color}`,
          background:
            ghost.kind === 'remove'
              ? `repeating-linear-gradient(135deg, ${tint(color, 40)} 0 2px, transparent 2px 9px)`
              : tint(color, draft ? 18 : 12),
        }}
      >
        {words && ghost.kind !== 'remove' ? (
          <span
            className="line-clamp-3 px-2 text-center text-sm font-medium text-slate-800 dark:text-slate-100"
            style={{ maxWidth: '100%' }}
          >
            {words}
          </span>
        ) : null}
      </div>
      <span
        className="absolute flex -translate-y-full items-center gap-1 whitespace-nowrap rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold leading-none text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
        style={{ left: shown.x - OUTSET, top: shown.y - OUTSET - 4 }}
      >
        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
        <span aria-hidden>{GLYPH[ghost.kind]}</span>
        <span>{draft ? 'Suggesting' : ghost.name || 'Someone'}</span>
        {ghost.conflict ? (
          <span className="text-amber-700 dark:text-amber-300">· Changed since</span>
        ) : null}
      </span>
    </div>
  );
}
