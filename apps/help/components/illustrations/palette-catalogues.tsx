// Palette catalogue-tab illustrations (spec/55): the Components, Devices, Icons,
// and Technology tabs of the floating palette. Composed only from the shared
// primitives so the house style holds; the four scenes share one catalogue
// frame so the palette chrome is drawn once, not redrawn per tab.

import type { ReactNode } from 'react';

import { Scene, Panel, Tabs, Label, TextBar, Tile } from './primitives';

/** The palette panel framing every catalogue tab: a titled panel with the
 *  catalogue tab strip and a search field, with the tab body drawn by callers.
 *  Reused by all four catalogue scenes so the chrome lives in one place. */
function CatalogueGrid({
  active,
  search,
  children,
}: {
  active: number;
  search: string;
  children: ReactNode;
}) {
  return (
    <Scene w={400} h={252} bg="plain">
      <Panel x={40} y={18} w={320} h={216} title="PALETTE">
        <Tabs
          x={56}
          y={54}
          items={['Components', 'Devices', 'Icons', 'Technology']}
          active={active}
          tabW={72}
          h={22}
        />
        {/* Search field */}
        <rect
          x={56}
          y={86}
          width={288}
          height={24}
          rx={7}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
        <circle cx={70} cy={98} r={5} className="fill-none stroke-slate-400" strokeWidth={1.6} />
        <path
          d="M73.5 101.5 L78 106"
          className="stroke-slate-400"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <Label x={84} y={99} size={10} tone="muted">
          {search}
        </Label>
        {children}
      </Panel>
    </Scene>
  );
}

/** Components tab: pre-assembled blocks (a banner, a callout, a stat row) shown
 *  as cards in the catalogue. */
export function ComponentsCatalogue() {
  return (
    <CatalogueGrid active={0} search="Search components">
      {/* Banner card */}
      <rect
        x={56}
        y={124}
        width={140}
        height={42}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect x={56} y={124} width={6} height={42} rx={3} className="fill-brand-500" />
      <Label x={72} y={138} size={10} weight={700} tone="strong">
        Banner
      </Label>
      <TextBar x={72} y={150} w={94} />
      {/* Callout card */}
      <rect
        x={204}
        y={124}
        width={140}
        height={42}
        rx={8}
        className="fill-brand-50 stroke-brand-200"
        strokeWidth={1.5}
      />
      <circle cx={220} cy={139} r={7} className="fill-brand-400" />
      <Label x={220} y={140} anchor="middle" size={9} weight={700} tone="onAccent">
        i
      </Label>
      <TextBar x={234} y={134} w={92} tone="accent" />
      <TextBar x={234} y={146} w={70} tone="faint" />
      {/* Stat row card */}
      <rect
        x={56}
        y={174}
        width={288}
        height={42}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {[0, 1, 2].map((i) => {
        const sx = 68 + i * 94;
        return (
          <g key={i}>
            <rect
              x={sx}
              y={182}
              width={82}
              height={26}
              rx={5}
              className="fill-slate-50 stroke-slate-200"
              strokeWidth={1}
            />
            <Label x={sx + 41} y={192} anchor="middle" size={11} weight={700} tone="accent">
              {['98%', '1.2k', '4.7'][i]}
            </Label>
            <TextBar x={sx + 21} y={200} w={40} tone="faint" />
          </g>
        );
      })}
    </CatalogueGrid>
  );
}

/** The edit-favourites modal (spec/78): search field, a 4-per-row tile grid
 *  with Control-Centre-style corner badges (red minus = favourited, green
 *  plus = available), and the Done affordance. Drawn without CatalogueGrid —
 *  it's a modal, not a palette tab. */
export function FavouritesCatalogue() {
  const glyph = 'fill-none stroke-slate-500';
  const tiles: { label: string; child: ReactNode }[] = [
    {
      label: 'Square',
      child: (
        <rect x={-6} y={-6} width={12} height={12} rx={2} className={glyph} strokeWidth={1.8} />
      ),
    },
    { label: 'Circle', child: <circle r={6.5} className={glyph} strokeWidth={1.8} /> },
    {
      label: 'Diamond',
      child: <polygon points="0,-7 7,0 0,7 -7,0" className={glyph} strokeWidth={1.8} />,
    },
    {
      label: 'Text',
      child: (
        <path
          d="M-5 -5h10M0 -5v10M-3 5h6"
          className={glyph}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ),
    },
    {
      label: 'Pencil',
      child: (
        <path
          d="M-6 6 L-4 4 M-4 4 L4 -4 L6 -6 M-4 4 L-2 6"
          className={glyph}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ),
    },
    {
      label: 'Arrow',
      child: <path d="M-6 0h12" className={glyph} strokeWidth={1.8} strokeLinecap="round" />,
    },
    {
      label: 'Note',
      child: (
        <path
          d="M-5 -5h7l3 3v7h-10zM2 -5v3h3"
          className={glyph}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ),
    },
    {
      label: 'Table',
      child: (
        <g className={glyph} strokeWidth={1.4}>
          <rect x={-6} y={-5} width={12} height={10} rx={1} />
          <path d="M-6 -1h12M-2 -5v10" />
        </g>
      ),
    },
    {
      label: 'Image',
      child: (
        <g className={glyph} strokeWidth={1.4}>
          <rect x={-6} y={-5.5} width={12} height={11} rx={1.5} />
          <path d="M-6 2 L-2 -2 L1 1 L4 -2 L6 0" />
        </g>
      ),
    },
  ];
  return (
    <Scene w={400} h={252} bg="plain">
      <Panel x={40} y={10} w={320} h={232} title="EDIT FAVOURITES">
        {/* Search field */}
        <rect
          x={56}
          y={44}
          width={288}
          height={22}
          rx={7}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
        <circle cx={69} cy={55} r={4.5} className="fill-none stroke-slate-400" strokeWidth={1.5} />
        <path
          d="M72.5 58.5 L76 62"
          className="stroke-slate-400"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <Label x={82} y={56} size={10} tone="muted">
          Search controls
        </Label>
        {/* Category pills: Shapes active */}
        {['Shapes', 'Tools', 'Data'].map((label, i) => {
          const x = 56 + i * 64;
          const active = i === 0;
          return (
            <g key={label}>
              <rect
                x={x}
                y={72}
                width={58}
                height={17}
                rx={4}
                className={
                  active ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'
                }
                strokeWidth={1.4}
              />
              <Label
                x={x + 29}
                y={81}
                anchor="middle"
                size={9}
                weight={active ? 700 : 500}
                tone={active ? 'accent' : 'muted'}
              >
                {label}
              </Label>
            </g>
          );
        })}
        {/* 4-per-row toggle tiles: red minus = favourited, green plus =
            available to add. */}
        {tiles.slice(0, 8).map((t, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const x = 64 + col * 74;
          const y = 100 + row * 46;
          const favourited = i < 3;
          return (
            <g key={t.label}>
              <Tile x={x} y={y} size={26} label={t.label}>
                {t.child}
              </Tile>
              <circle
                cx={x - 1}
                cy={y - 1}
                r={5}
                className={favourited ? 'fill-red-500' : 'fill-emerald-500'}
              />
              <path
                d={
                  favourited
                    ? `M${x - 3.5} ${y - 1}h5`
                    : `M${x - 3.5} ${y - 1}h5 M${x - 1} ${y - 3.5}v5`
                }
                className="stroke-white"
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            </g>
          );
        })}
        {/* Done affordance, bottom-right */}
        <rect x={296} y={212} width={48} height={18} rx={5} className="fill-brand-500" />
        <Label x={320} y={221} anchor="middle" size={9} weight={700} tone="onAccent">
          ✓ Done
        </Label>
      </Panel>
    </Scene>
  );
}

/** Devices tab: wireframe device frames (a browser window, a phone, a laptop)
 *  shown side by side in the catalogue. */
export function DevicesCatalogue() {
  return (
    <CatalogueGrid active={1} search="Search devices">
      {/* Browser window */}
      <g>
        <rect
          x={56}
          y={124}
          width={146}
          height={78}
          rx={8}
          className="fill-white stroke-slate-300"
          strokeWidth={2}
        />
        <rect x={56} y={124} width={146} height={18} rx={8} className="fill-slate-100" />
        <rect x={56} y={136} width={146} height={6} className="fill-slate-100" />
        <circle cx={66} cy={133} r={2.5} className="fill-slate-300" />
        <circle cx={74} cy={133} r={2.5} className="fill-slate-300" />
        <circle cx={82} cy={133} r={2.5} className="fill-slate-300" />
        <rect
          x={92}
          y={129}
          width={102}
          height={8}
          rx={4}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        <TextBar x={66} y={154} w={118} tone="faint" />
        <TextBar x={66} y={167} w={92} tone="faint" />
        <rect x={66} y={179} width={58} height={16} rx={4} className="fill-brand-100" />
        <Label x={129} y={216} anchor="middle" size={9} tone="muted">
          Web Browser
        </Label>
      </g>
      {/* Phone */}
      <g>
        <rect
          x={222}
          y={124}
          width={48}
          height={78}
          rx={9}
          className="fill-white stroke-slate-300"
          strokeWidth={2}
        />
        <rect x={234} y={128} width={24} height={3} rx={1.5} className="fill-slate-200" />
        <TextBar x={230} y={142} w={32} tone="faint" />
        <rect x={230} y={152} width={32} height={20} rx={4} className="fill-brand-100" />
        <TextBar x={230} y={180} w={32} tone="faint" />
        <TextBar x={230} y={190} w={22} tone="faint" />
        <Label x={246} y={216} anchor="middle" size={9} tone="muted">
          Phone
        </Label>
      </g>
      {/* Laptop */}
      <g>
        <rect
          x={290}
          y={130}
          width={56}
          height={40}
          rx={4}
          className="fill-white stroke-slate-300"
          strokeWidth={2}
        />
        <rect x={296} y={136} width={44} height={28} rx={2} className="fill-slate-50" />
        <path
          d="M284 174 H352 L348 166 H288 Z"
          className="fill-slate-100 stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={318} y={216} anchor="middle" size={9} tone="muted">
          Laptop
        </Label>
      </g>
    </CatalogueGrid>
  );
}

/** Icons tab: a searchable grid of single-colour glyph icons. */
export function IconsCatalogue() {
  const glyphs: ReactNode[] = [
    // server
    <g key="g">
      <rect
        x={-8}
        y={-7}
        width={16}
        height={6}
        rx={1.5}
        className="stroke-brand-500"
        strokeWidth={1.6}
        fill="none"
      />
      <rect
        x={-8}
        y={2}
        width={16}
        height={6}
        rx={1.5}
        className="stroke-brand-500"
        strokeWidth={1.6}
        fill="none"
      />
      <circle cx={-4} cy={-4} r={1} className="fill-brand-500" />
      <circle cx={-4} cy={5} r={1} className="fill-brand-500" />
    </g>,
    // heart
    <path
      key="h"
      d="M0 6 C-8 0 -6 -8 0 -3 C6 -8 8 0 0 6 Z"
      className="stroke-brand-500"
      strokeWidth={1.6}
      fill="none"
    />,
    // calendar
    <g key="c">
      <rect
        x={-8}
        y={-6}
        width={16}
        height={13}
        rx={2}
        className="stroke-brand-500"
        strokeWidth={1.6}
        fill="none"
      />
      <path d="M-8 -2 H8 M-4 -8 V-4 M4 -8 V-4" className="stroke-brand-500" strokeWidth={1.6} />
    </g>,
    // user
    <g key="u">
      <circle cx={0} cy={-3} r={3.5} className="stroke-brand-500" strokeWidth={1.6} fill="none" />
      <path d="M-6 7 a6 6 0 0 1 12 0" className="stroke-brand-500" strokeWidth={1.6} fill="none" />
    </g>,
    // lock
    <g key="l">
      <rect
        x={-6}
        y={-1}
        width={12}
        height={9}
        rx={2}
        className="stroke-brand-500"
        strokeWidth={1.6}
        fill="none"
      />
      <path
        d="M-3 -1 V-4 a3 3 0 0 1 6 0 V-1"
        className="stroke-brand-500"
        strokeWidth={1.6}
        fill="none"
      />
    </g>,
    // file
    <g key="f">
      <path
        d="M-5 -8 H3 L7 -4 V8 H-5 Z"
        className="stroke-brand-500"
        strokeWidth={1.6}
        fill="none"
      />
      <path d="M3 -8 V-4 H7" className="stroke-brand-500" strokeWidth={1.6} fill="none" />
    </g>,
    // chart
    <g key="ch">
      <path d="M-7 8 V-7 M-7 8 H8" className="stroke-brand-500" strokeWidth={1.6} fill="none" />
      <path
        d="M-3 4 V0 M1 4 V-3 M5 4 V-5"
        className="stroke-brand-500"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </g>,
    // arrow
    <path
      key="a"
      d="M-7 0 H6 M2 -4 L6 0 L2 4"
      className="stroke-brand-500"
      strokeWidth={1.8}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    // bin
    <g key="b">
      <path
        d="M-6 -3 H6 M-4 -3 V7 H4 V-3 M-3 -3 V-5 H3 V-3"
        className="stroke-brand-500"
        strokeWidth={1.6}
        fill="none"
        strokeLinejoin="round"
      />
    </g>,
    // gear
    <g key="ge">
      <circle r={3} className="stroke-brand-500" strokeWidth={1.6} fill="none" />
      <path
        d="M0 -7 V-4 M0 4 V7 M-7 0 H-4 M4 0 H7 M-5 -5 L-3 -3 M5 5 L3 3 M5 -5 L3 -3 M-5 5 L-3 3"
        className="stroke-brand-500"
        strokeWidth={1.4}
      />
    </g>,
    // cloud
    <path
      key="cl"
      d="M-6 5 a4 4 0 0 1 0 -8 a5 5 0 0 1 10 0 a3.5 3.5 0 0 1 0 8 Z"
      className="stroke-brand-500"
      strokeWidth={1.6}
      fill="none"
    />,
    // star
    <path
      key="s"
      d="M0 -7 L2 -2 L7 -2 L3 1 L5 6 L0 3 L-5 6 L-3 1 L-7 -2 L-2 -2 Z"
      className="stroke-brand-500"
      strokeWidth={1.4}
      fill="none"
      strokeLinejoin="round"
    />,
  ];
  return (
    <CatalogueGrid active={2} search="server">
      {glyphs.map((g, i) => {
        const col = i % 6;
        const row = Math.floor(i / 6);
        const tx = 56 + col * 48;
        const ty = 124 + row * 46;
        const sel = i === 0;
        return (
          <g key={i}>
            <rect
              x={tx}
              y={ty}
              width={42}
              height={38}
              rx={7}
              className={sel ? 'fill-brand-50 stroke-brand-500' : 'fill-white stroke-slate-200'}
              strokeWidth={sel ? 2 : 1.5}
            />
            <g transform={`translate(${tx + 21} ${ty + 19})`}>{g}</g>
          </g>
        );
      })}
    </CatalogueGrid>
  );
}

/** Technology tab: a grid of full-colour infrastructure brand tiles in their
 *  own accent hues, each captioned. */
export function TechnologyCatalogue() {
  const tiles: { label: string; fill: string; glyph: ReactNode }[] = [
    {
      label: 'S3',
      fill: 'fill-emerald-500',
      glyph: (
        <path
          d="M-7 -5 a7 3 0 0 0 14 0 v10 a7 3 0 0 1 -14 0 Z M-7 -5 a7 3 0 0 0 14 0"
          className="stroke-white"
          strokeWidth={1.6}
          fill="none"
        />
      ),
    },
    {
      label: 'Lambda',
      fill: 'fill-amber-500',
      glyph: (
        <path
          d="M-6 6 L-1 -6 L1 -6 L7 6 M-3 0 L3 0"
          className="stroke-white"
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ),
    },
    {
      label: 'EC2',
      fill: 'fill-rose-500',
      glyph: (
        <g>
          <rect
            x={-6}
            y={-6}
            width={12}
            height={12}
            rx={1.5}
            className="stroke-white"
            strokeWidth={1.6}
            fill="none"
          />
          <path
            d="M-3 -8 V8 M3 -8 V8 M-8 -3 H8 M-8 3 H8"
            className="stroke-white"
            strokeWidth={1.2}
          />
        </g>
      ),
    },
    {
      label: 'Azure SQL',
      fill: 'fill-indigo-500',
      glyph: (
        <path
          d="M-6 -4 a6 3 0 0 0 12 0 v8 a6 3 0 0 1 -12 0 Z M-6 -4 a6 3 0 0 0 12 0 M-6 0 a6 3 0 0 0 12 0"
          className="stroke-white"
          strokeWidth={1.4}
          fill="none"
        />
      ),
    },
    {
      label: 'Functions',
      fill: 'fill-teal-500',
      glyph: (
        <path
          d="M-5 6 q-2 0 -2 -3 v-6 q0 -3 -2 -3 M5 6 q2 0 2 -3 v-6 q0 -3 2 -3"
          className="stroke-white"
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
      ),
    },
    {
      label: 'Kubernetes',
      fill: 'fill-violet-500',
      glyph: (
        <g>
          <path
            d="M0 -7 L6 -3 L4 5 L-4 5 L-6 -3 Z"
            className="stroke-white"
            strokeWidth={1.4}
            fill="none"
            strokeLinejoin="round"
          />
          <circle r={2} className="stroke-white" strokeWidth={1.2} fill="none" />
        </g>
      ),
    },
    {
      label: 'Postgres',
      fill: 'fill-brand-500',
      glyph: (
        <g>
          <ellipse rx={6} ry={7} className="stroke-white" strokeWidth={1.5} fill="none" />
          <path d="M0 -3 a3 3 0 0 1 0 6" className="stroke-white" strokeWidth={1.4} fill="none" />
        </g>
      ),
    },
    {
      label: 'Redis',
      fill: 'fill-rose-500',
      glyph: (
        <path
          d="M-7 -3 L0 -6 L7 -3 L0 0 Z M-7 1 L0 -2 L7 1 L0 4 Z"
          className="stroke-white"
          strokeWidth={1.3}
          fill="none"
          strokeLinejoin="round"
        />
      ),
    },
  ];
  return (
    <CatalogueGrid active={3} search="Search technology">
      {tiles.map((t, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const tx = 60 + col * 74;
        const ty = 124 + row * 48;
        return (
          <g key={i}>
            <rect x={tx} y={ty} width={36} height={36} rx={8} className={t.fill} />
            <g transform={`translate(${tx + 18} ${ty + 18})`}>{t.glyph}</g>
            <Label x={tx + 18} y={ty + 44} anchor="middle" size={8} tone="muted">
              {t.label}
            </Label>
          </g>
        );
      })}
    </CatalogueGrid>
  );
}
