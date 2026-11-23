'use client';

// The colour picker (docs/specs/004-interface-design/colour-picker.md): the one control every
// surface chooses a colour with. Top to bottom: the Theme Palette (the active tab's), the standard
// colours, and Custom colours ending in +, which opens the custom colour editor in place. Leading
// options (no colour, a surface's named defaults) go first in the first group. One Tab stop, the
// arrows move through every swatch, Enter or Space picks. On a picker that colours text, a row under the
// groups says whether the colour judged reads where the text sits (ContrastHint, judging useJudgedSwatch's swatch).
import { useContext, useId, useRef, useState, type FocusEvent } from 'react';
import { isHexColour } from '@liveknowledge/document';
import {
  onMouseHover,
  useRevertOnUnmount,
} from '@liveworkspace/workbench/components/primitives/hover-preview';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { YOUR_COLOURS_MAX } from '@/lib/document-colours';
import { CustomColourEditor } from '@liveworkspace/workbench/components/colour/CustomColourEditor';
import { MoreColoursGlyph } from './MoreColoursGlyph';
import { ColourSwatch } from '@liveworkspace/workbench/components/colour/ColourSwatch';
import { COLOUR_PICKER_WIDTH } from '@liveworkspace/workbench/components/colour/colour-metrics';
import {
  hexOption,
  optionMatches,
  stableColours,
  type ColourGroup,
  type ColourOption,
} from '@liveworkspace/workbench/components/colour/colour-options';
import { onColourKeys } from '@liveworkspace/workbench/components/colour/useColourKeys';
import { useThemeColours } from './useThemeColours';
import { ContrastHint } from '@liveworkspace/workbench/components/colour/ContrastHint';
import { useJudgedSwatch } from '@liveworkspace/workbench/components/colour/useJudgedSwatch';
import type { TextContrastProbe } from '@/lib/text-contrast-probe';

const NOOP = () => {};

export type ColourPickerProps = {
  // The whole picker's accessible name ("Text colour").
  label: string;
  // The id or #rrggbb in force; nothing matches null or undefined.
  value: string | null | undefined;
  // A swatch's id, or a custom colour's lower-case #rrggbb.
  onPick: (id: string) => void;
  // No colour and the surface's named defaults, first in the first group.
  leading?: readonly ColourOption[];
  // The Theme Palette; omitted, the active tab's theme colours (useThemeColours).
  theme?: readonly ColourOption[];
  // The standard colours: one row ("Colours"), or a soft and a strong row.
  standard?: readonly ColourGroup[];
  // Custom colours: the document's custom colours, newest first.
  yours?: readonly string[];
  // The custom colour editor's hard-to-see warning, for a canvas line or text.
  boardWarning?: boolean;
  // Live preview while a swatch is hovered or focused, and its revert.
  onPreview?: (id: string) => void;
  onPreviewEnd?: () => void;
  // Where the text sits, one ground or several, to judge its colours on (colour-picker.md "Reading on
  // its ground").
  contrast?: readonly TextContrastProbe[];
};

type Group = { heading: string; options: readonly ColourOption[] };

export function ColourPicker({
  label,
  value,
  onPick,
  leading = [],
  theme,
  standard = [],
  yours = [],
  boardWarning = false,
  onPreview,
  onPreviewEnd,
  contrast,
}: ColourPickerProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  // The swatch the pointer or focus last rested on, judged in place of the colour in force; only kept while there is
  // a contrast hint, so other pickers never re-render on hover. Focus previews and is judged only once a key is
  // pressed in the picker: the swatches it focuses as it opens (its first key, then its Tab stop) are not, so opening
  // changes nothing and the hint opens on the colour in force.
  const judging = useJudgedSwatch(contrast !== undefined);
  // + takes focus back when the editor closes, so it never drops to the page (where Escape would reach
  // the canvas and drop the tool in hand, rather than close the surface the picker sits in).
  const plusRef = useRef<HTMLButtonElement>(null);
  // A colour picked with + becomes one of the document's custom colours (none outside the editor).
  const addCustomColour = useContext(EditorContext)?.addCustomColour;
  const headingId = useId();
  useRevertOnUnmount(onPreviewEnd ?? NOOP);

  // A surface's own Theme Palette (a Quick Style row's colours), else the active tab's theme.
  const tabTheme = useThemeColours();
  const themeGroup = theme ?? tabTheme;
  const groups: Group[] = [
    ...(themeGroup.length > 0 ? [{ heading: 'Theme Palette', options: themeGroup }] : []),
    ...standard,
  ];
  if (leading.length > 0) {
    if (groups.length === 0) groups.push({ heading: 'Colours', options: leading });
    else groups[0] = { ...groups[0]!, options: [...leading, ...groups[0]!.options] };
  }
  const offered = groups.flatMap((g) => g.options);
  // The custom colour in force shows first in Custom colours, used anywhere else or not.
  const inForce =
    isHexColour(value) && !offered.some((o) => optionMatches(o, value))
      ? value.toLowerCase()
      : null;
  const yourHexes = [
    ...(inForce ? [inForce] : []),
    ...yours
      .map((c) => c.toLowerCase())
      .filter((c) => c !== inForce && !offered.some((o) => optionMatches(o, c))),
  ].slice(0, YOUR_COLOURS_MAX);
  // Held for as long as the picker is open, so a hover preview never reorders it; frozen while the
  // custom editor previews, so dragging its hue adds nothing until Use.
  const [shown, setShown] = useState<readonly string[]>(yourHexes);
  const nextShown = editorOpen ? shown : stableColours(shown, yourHexes, YOUR_COLOURS_MAX);
  if (nextShown !== shown) setShown(nextShown);
  const all: Group[] = [
    ...groups,
    { heading: 'Custom Colours', options: nextShown.map(hexOption) },
  ];

  // The one Tab stop: the picked swatch, else the first key (a swatch, or + alone).
  const flat = all.flatMap((g) => g.options);
  const pickedAt = flat.findIndex((o) => optionMatches(o, value));
  const tabStop = pickedAt >= 0 ? pickedAt : 0;

  const previewEndOnLeave = (e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    onPreviewEnd?.();
    judging.end();
  };
  const leave = () => {
    onPreviewEnd?.();
    judging.end();
  };
  const hover = onPreview || contrast;
  // The mouse reaching the hint past swatches it only crossed: the one it rested on is previewed and judged again.
  const arrive = () => {
    const back = judging.arrive();
    if (!back) return;
    if (back.id === null) onPreviewEnd?.();
    else onPreview?.(back.id);
  };

  let index = 0;
  return (
    <div
      role="group"
      aria-label={label}
      data-colour-picker=""
      className="flex flex-col gap-2.5"
      style={{ width: COLOUR_PICKER_WIDTH }}
      onKeyDown={(e) => {
        judging.keyed();
        onColourKeys(e);
      }}
      onPointerLeave={onPreviewEnd || contrast ? onMouseHover(leave) : undefined}
      onBlur={onPreviewEnd || contrast ? previewEndOnLeave : undefined}
    >
      {all.map((group, g) => {
        const id = `${headingId}-${g}`;
        const yoursGroup = g === all.length - 1;
        return (
          <div key={group.heading + g} role="group" aria-labelledby={id}>
            <p
              id={id}
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {group.heading}
            </p>
            <div className="flex flex-wrap gap-1">
              {group.options.map((option) => {
                const at = index++;
                return (
                  <ColourSwatch
                    key={option.id}
                    label={option.label}
                    colour={option.colour}
                    none={option.none}
                    picked={optionMatches(option, value)}
                    tabIndex={at === tabStop ? 0 : -1}
                    onClick={() => onPick(option.id)}
                    onFocus={
                      hover
                        ? () => {
                            if (judging.focus(option.id)) onPreview?.(option.id);
                          }
                        : undefined
                    }
                    onPointerEnter={
                      hover
                        ? onMouseHover(() => {
                            onPreview?.(option.id);
                            judging.hover(option.id);
                          })
                        : undefined
                    }
                  />
                );
              })}
              {yoursGroup ? (
                <button
                  ref={plusRef}
                  type="button"
                  aria-label="Add a custom colour"
                  aria-expanded={editorOpen}
                  data-colour-key=""
                  tabIndex={flat.length === 0 ? 0 : -1}
                  onClick={() => setEditorOpen((open) => !open)}
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
                >
                  {/* More colours' four dots, as every way into more colours (colour-picker.md "Skins"). */}
                  <MoreColoursGlyph />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      {contrast ? (
        <ContrastHint probes={contrast} judged={judging.judged} onUse={onPick} onArrive={arrive} />
      ) : null}
      {editorOpen ? (
        <CustomColourEditor
          start={inForce ?? undefined}
          boardWarning={boardWarning}
          onPreview={onPreview}
          onUse={(hex) => {
            setEditorOpen(false);
            const picked = hex.toLowerCase();
            plusRef.current?.focus();
            addCustomColour?.(picked);
            onPick(picked);
          }}
        />
      ) : null}
    </div>
  );
}
