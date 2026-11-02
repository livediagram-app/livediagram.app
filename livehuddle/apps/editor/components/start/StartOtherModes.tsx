'use client';

// Found in other modes (docs/specs/007-editor/start-diagramming.md "Found in other modes"): under a start's own search
// results, the templates of every other mode that matched, one block a mode (its icon, name and count), each card
// saying where it leads ("Opens in Workshop"). At most OTHER_MODE_CARDS_MAX a mode, then Show All. Choosing one lands
// it on the tab, which switches to the template's mode. The host keys it on the search, so a new search starts folded.
import { useState, type CSSProperties } from 'react';
import { CountBadge, EDITOR_MODE_ICONS } from '@livehuddle/ui';
import { editorModeLabel, type EditorMode } from '@livehuddle/document';
import type { StartPalette } from './start-palette';
import { StartCardGrid, startTint, type StartPanelCard } from './StartCard';
import { OTHER_MODE_CARDS_MAX } from './other-mode-matches';

export type StartPanelElsewhere = { mode: EditorMode; cards: readonly StartPanelCard[] };

function OpensIn({ mode, palette }: { mode: EditorMode; palette: StartPalette }) {
  const Icon = EDITOR_MODE_ICONS[mode];
  return (
    <span
      aria-hidden
      className="mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-medium"
      style={{ backgroundColor: startTint(palette, 10), color: palette.focus }}
    >
      <Icon size={11} />
      Opens in {editorModeLabel(mode)}
    </span>
  );
}

export function StartOtherModes({
  groups,
  palette,
  divided,
  cascade,
  onChoose,
}: {
  groups: readonly StartPanelElsewhere[];
  palette: StartPalette;
  // Below the mode's own results: a hairline above it. Alone (nothing of this mode matched), none.
  divided: boolean;
  cascade: boolean;
  onChoose: (mode: EditorMode, cardId: string) => void;
}) {
  const [open, setOpen] = useState<ReadonlySet<EditorMode>>(() => new Set());
  return (
    <section
      aria-labelledby="start-other-modes"
      className={divided ? 'mt-8 border-t pt-6 max-sm:mt-6 max-sm:pt-5' : ''}
      style={{ borderColor: palette.border }}
    >
      <h3 id="start-other-modes" className="text-[16px] font-semibold">
        In Other Modes
      </h3>
      <p className="mb-4 mt-0.5 text-[13px] max-sm:mb-3" style={{ color: palette.muted }}>
        Choosing one switches this tab to its mode.
      </p>
      {groups.map(({ mode, cards }) => {
        const Icon = EDITOR_MODE_ICONS[mode];
        const label = editorModeLabel(mode);
        const all = open.has(mode);
        const shown = all ? cards : cards.slice(0, OTHER_MODE_CARDS_MAX);
        return (
          <section key={mode} aria-label={label} data-other-mode={mode} className="mb-6 last:mb-0">
            <div className="mb-3 flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: startTint(palette, 14), color: palette.focus }}
              >
                <Icon size={16} />
              </span>
              <h4 className="text-[14px] font-semibold">{label}</h4>
              <CountBadge count={cards.length} background={palette.column} color={palette.muted} />
            </div>
            <StartCardGrid
              cards={shown.map((card) => ({
                ...card,
                ariaKind: `in ${label}`,
                note: <OpensIn mode={mode} palette={palette} />,
              }))}
              palette={palette}
              cascade={cascade}
              onChoose={(id) => onChoose(mode, id)}
            />
            {cards.length > shown.length ? (
              <button
                type="button"
                onClick={() => setOpen((s) => new Set(s).add(mode))}
                className="mt-3 cursor-pointer rounded-xl border px-3 py-1.5 text-[13px] font-medium transition hover:border-[var(--start-accent)] hover:bg-[var(--start-hover)]"
                style={
                  {
                    borderColor: palette.border,
                    color: palette.text,
                    '--start-hover': startTint(palette, 7),
                  } as CSSProperties
                }
              >
                Show All {cards.length}
              </button>
            ) : null}
          </section>
        );
      })}
    </section>
  );
}
