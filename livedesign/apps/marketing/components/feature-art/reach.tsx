// Feature illustrations for getting around and getting it out: the search panel that doubles as a
// command palette, following a teammate's view, and a design shown live somewhere else (an embed
// or a live image in a README). Panels use the editor's floating chrome; shapes the Default ink.

import type { CSSProperties } from 'react';

import { TEAMMATE, YOU } from '@/components/art-tokens';
import {
  Caret,
  HAIRLINE,
  PANEL,
  SHADOW,
  Scene,
  TEXT_BODY,
  TEXT_MUTED,
  TEXT_STRONG,
} from '@liveworkspace/marketing-site/components/feature-art/canvas-marks';
import { Cursor, Frame, MONO } from '@liveworkspace/marketing-site/components/feature-art/shared';
import { MiniPage } from './page-tiles';

// The search panel: "logo" typed after ⌘K, one hit in each of its groups in their order (Designs, Tabs,
// Actions, Help; packages/workbench/src/lib/editor-search/build-search-results.ts): a design, a tab, Mirror Copy
// (its keywords take "logo" on a logo page's selection) highlighted to run on Enter, and the Logo Pages article.
export function SearchPaletteArt() {
  const rows = [
    { group: 'Designs', label: 'Bloom Logo', hint: '' },
    { group: 'Tabs', label: 'Logo Concepts', hint: '' },
    { group: 'Actions', label: 'Mirror Copy', hint: '↵', active: true },
    { group: 'Help', label: 'Logo Pages', hint: '' },
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
          logo
        </text>
        <Caret x={92} y={13} h={9} />
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

// Follow along: your view (the frame) gliding to where a teammate is looking, their cursor on the
// screen they mean, and the Following pill at the top of your canvas.
export function FollowAlongArt() {
  return (
    <Frame canvas>
      <Scene>
        <MiniPage x={24} y={36} w={36} h={36} kind="logo" />
        <MiniPage x={92} y={30} w={28} h={50} kind="phone" title="Sign in" />
        <MiniPage x={146} y={30} w={28} h={50} kind="phone" title="Home" />
        <MiniPage x={198} y={40} w={30} h={44} kind="phone" title="Verify" />
        {/* Your view, following theirs across the canvas. */}
        <g className="fa-d-move" style={{ '--fx': '-150px', '--fy': '-14px' } as CSSProperties}>
          <rect
            x="184"
            y="36"
            width="96"
            height="52"
            rx="4"
            fill="none"
            stroke={YOU}
            strokeWidth="1.2"
            strokeDasharray="4 2.5"
          />
          <g transform="translate(220 56)">
            <Cursor color={TEAMMATE} name="Maya" />
          </g>
        </g>
        {/* The Following pill. */}
        <g className={SHADOW}>
          <rect className={PANEL} x="96" y="6" width="108" height="15" rx="7.5" strokeWidth="0.8" />
        </g>
        <circle cx="106" cy="13.5" r="4" fill={TEAMMATE} />
        <text x="106" y="15.4" fontSize="4.6" fontWeight="700" fill="#fff" textAnchor="middle">
          M
        </text>
        <text className={TEXT_STRONG} x="113" y="15.6" fontSize="6">
          Following Maya
        </text>
        <text
          className="fill-brand-700 dark:fill-brand-300"
          x="196"
          y="15.6"
          fontSize="6"
          fontWeight="700"
          textAnchor="end"
        >
          Stop
        </text>
      </Scene>
    </Frame>
  );
}

// A live image in a README: the Markdown the Share dialog copies, pasted on the left, and the rendered
// README on the right showing the design as it is now, the dark logo added after the latest save.
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
          ## Brand
        </text>
        <text className={TEXT_BODY} x="18" y="52" fontSize="5" fontFamily={MONO}>
          ![design](https://www.
        </text>
        <text className={TEXT_BODY} x="18" y="60" fontSize="5" fontFamily={MONO}>
          livedesign.app/api/share/
        </text>
        <text className={TEXT_BODY} x="18" y="68" fontSize="5" fontFamily={MONO}>
          9fk2/image.svg)
        </text>
        <rect
          className="fa-d-ring fill-brand-500/10 stroke-brand-500 dark:stroke-brand-400"
          x="15"
          y="45"
          width="108"
          height="27"
          rx="2"
          strokeWidth="0.8"
        />
        {/* The rendered README: the heading, then the live image of the design as it is now. */}
        <g className={SHADOW}>
          <rect className={PANEL} x="140" y="10" width="150" height="76" rx="4" strokeWidth="0.8" />
        </g>
        <text className={TEXT_STRONG} x="148" y="24" fontSize="7" fontWeight="700">
          Brand
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
        <MiniPage x={156} y={35} w={38} h={38} kind="logo" />
        <MiniPage x={202} y={33} w={24} h={42} kind="phone" />
        {/* The page added after the latest save, already in the image. */}
        <g className="fa-d-land" style={{ animationDelay: '0.8s' }}>
          <rect x="234" y="35" width="38" height="38" rx="1.6" fill="#0f172a" />
          <circle cx="253" cy="51" r="7.2" fill="none" stroke="#7dd3fc" strokeWidth="2.8" />
          <circle cx="253" cy="51" r="2.8" fill="#c4b5fd" />
          <text x="253" y="67" fontSize="5.7" fontWeight="800" textAnchor="middle" fill="#f8fafc">
            Bloom
          </text>
        </g>
      </Scene>
    </Frame>
  );
}
