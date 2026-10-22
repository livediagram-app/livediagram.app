// Feature illustrations for getting around and getting it out: the search panel that doubles as a
// command palette, and a document shown live somewhere else (an embed
// or a live image in a README). Panels use the editor's floating chrome; diagrams the Default ink.

import {
  ARROW,
  Caret,
  HAIRLINE,
  INK,
  INK_TEXT,
  PANEL,
  SHADOW,
  Scene,
  TEXT_BODY,
  TEXT_MUTED,
  TEXT_STRONG,
} from './canvas-marks';
import { Frame, MONO } from './shared';

// The search panel: "lay" typed after ⌘K, a matching tab and element above, then the Actions group
// with Auto Layout and the Eraser tool, the first action highlighted to run on Enter.
export function SearchPaletteArt() {
  const rows = [
    { group: 'Tabs', label: 'Layout ideas', hint: 'Tab' },
    { group: 'Actions', label: 'Auto Layout', hint: '↵', active: true },
    { group: '', label: 'Auto-align to Grid', hint: '' },
    { group: '', label: 'Eraser Tool', hint: 'Tool' },
  ];
  return (
    <Frame canvas>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="54" y="6" width="192" height="86" rx="6" strokeWidth="0.8" />
        </g>
        {/* The search box. */}
        <circle className="stroke-slate-400" cx="66" cy="18" r="3.2" fill="none" strokeWidth="1" />
        <path className="stroke-slate-400" d="M68.4 20.4 l2.4 2.4" strokeWidth="1" />
        <text className={TEXT_STRONG} x="76" y="20.4" fontSize="7">
          lay
        </text>
        <Caret x={88} y={13} h={9} />
        <rect
          className="fill-slate-100 dark:fill-slate-800"
          x="216"
          y="12"
          width="22"
          height="11"
          rx="2.5"
        />
        <text
          className={TEXT_BODY}
          x="227"
          y="19.6"
          fontSize="5.4"
          fontFamily={MONO}
          textAnchor="middle"
        >
          ⌘K
        </text>
        <line className={HAIRLINE} x1="54" x2="246" y1="28" y2="28" strokeWidth="0.8" />
        {rows.map((r, i) => {
          const y = 38 + i * 14;
          return (
            <g key={r.label}>
              {r.group ? (
                <text
                  className={TEXT_MUTED}
                  x="62"
                  y={y - 1}
                  fontSize="4.4"
                  fontWeight="700"
                  letterSpacing="0.3"
                >
                  {r.group.toUpperCase()}
                </text>
              ) : null}
              {r.active ? (
                <rect
                  className="fa-d-ring fill-brand-500/15 dark:fill-brand-400/20"
                  x="96"
                  y={y - 7.5}
                  width="146"
                  height="12"
                  rx="3"
                />
              ) : null}
              <text className={TEXT_STRONG} x="102" y={y} fontSize="6.2">
                {r.label}
              </text>
              {r.hint ? (
                <text className={TEXT_MUTED} x="236" y={y} fontSize="5" textAnchor="end">
                  {r.hint}
                </text>
              ) : null}
            </g>
          );
        })}
      </Scene>
    </Frame>
  );
}

// A live image in a README: the Markdown pasted on the left, and the rendered page on the right
// showing the diagram as it is now, a fresh box arriving after the latest save.
export function LiveImageArt() {
  return (
    <Frame>
      <Scene>
        {/* The README source. */}
        <g className={SHADOW}>
          <rect className={PANEL} x="10" y="10" width="118" height="76" rx="4" strokeWidth="0.8" />
        </g>
        <text className={TEXT_MUTED} x="18" y="22" fontSize="5" fontWeight="700">
          README.md
        </text>
        <line className={HAIRLINE} x1="10" x2="128" y1="27" y2="27" strokeWidth="0.8" />
        <text className={TEXT_STRONG} x="18" y="39" fontSize="6.4" fontFamily={MONO}>
          ## Architecture
        </text>
        <text className={TEXT_BODY} x="18" y="53" fontSize="5.6" fontFamily={MONO}>
          ![diagram](https://
        </text>
        <text className={TEXT_BODY} x="18" y="62" fontSize="5.6" fontFamily={MONO}>
          liveplanner.app/…/live.svg)
        </text>
        <rect
          className="fa-d-ring fill-brand-500/10 stroke-brand-500 dark:stroke-brand-400"
          x="15"
          y="46"
          width="108"
          height="20"
          rx="2"
          strokeWidth="0.8"
        />
        {/* The rendered page. */}
        <g className={SHADOW}>
          <rect className={PANEL} x="140" y="10" width="150" height="76" rx="4" strokeWidth="0.8" />
        </g>
        <text className={TEXT_STRONG} x="148" y="24" fontSize="7" fontWeight="700">
          Architecture
        </text>
        <rect
          x="148"
          y="30"
          width="134"
          height="48"
          rx="2"
          className="fill-(--art-paper) stroke-slate-200 dark:stroke-slate-700"
          strokeWidth="0.6"
        />
        <rect className={INK} x="156" y="44" width="32" height="18" rx="2" strokeWidth="0.9" />
        <text className={INK_TEXT} x="172" y="55" fontSize="5.4" textAnchor="middle">
          Web
        </text>
        <line className={ARROW} x1="188" x2="200" y1="53" y2="53" strokeWidth="0.9" />
        <path className="fill-(--art-arrow)" d="M203 53 l-3.6 -2.1 v4.2z" />
        <rect className={INK} x="203" y="44" width="32" height="18" rx="2" strokeWidth="0.9" />
        <text className={INK_TEXT} x="219" y="55" fontSize="5.4" textAnchor="middle">
          API
        </text>
        {/* The box added after the latest save, already in the image. */}
        <g className="fa-d-land" style={{ animationDelay: '0.8s' }}>
          <line className={ARROW} x1="235" x2="244" y1="53" y2="53" strokeWidth="0.9" />
          <path className="fill-(--art-arrow)" d="M247 53 l-3.6 -2.1 v4.2z" />
          <rect className={INK} x="247" y="44" width="30" height="18" rx="2" strokeWidth="0.9" />
          <text className={INK_TEXT} x="262" y="55" fontSize="5.4" textAnchor="middle">
            Queue
          </text>
        </g>
      </Scene>
    </Frame>
  );
}
