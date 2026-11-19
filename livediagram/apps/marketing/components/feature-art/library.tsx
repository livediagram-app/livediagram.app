// Feature illustration for the Diagrams category: a selection saved to the Library and waiting in the palette,
// split from ./keeping. On the 300 by 96 stage of ./canvas-parts, moving on the shared canvas timeline (fa-a-*).
import type { ReactNode } from 'react';
import { Box, Connector, Glyph, MUTED, Panel, Pointer, Scene, TEXT, YOU, at } from './canvas-parts';

/** A tile in the palette's Library (packages/workbench/src/components/library/LibraryTile.tsx): its preview over
 *  its title. */
function LibraryTile({
  x,
  y,
  title,
  fresh = false,
  children,
}: {
  x: number;
  y: number;
  title: string;
  fresh?: boolean;
  children: ReactNode;
}) {
  return (
    <g>
      <rect
        className={
          fresh
            ? 'fill-sky-50 stroke-sky-400 dark:fill-sky-500/15 dark:stroke-sky-400'
            : 'fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700'
        }
        x={x}
        y={y}
        width="34"
        height="16"
        rx="2.5"
        strokeWidth="0.8"
      />
      {children}
      <text className={TEXT} x={x + 17} y={y + 21.4} fontSize="4.4" textAnchor="middle">
        {title}
      </text>
    </g>
  );
}

const MINI = 'fill-(--art-ink-fill) stroke-(--art-ink-stroke)';

/**
 * Save to Library: the selection toolbar's bookmark (More, Duplicate, Save to Library, Export, Lock and Delete, as
 * MultiSelectionToolbar orders them) saves the selection, and it lands first under Personal in the palette's Library,
 * above the team's own.
 */
export function LibraryArt() {
  return (
    <Scene>
      {/* The selection on the canvas. */}
      <rect
        className="fill-none stroke-sky-500"
        x="14"
        y="38"
        width="112"
        height="42"
        rx="3"
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      <Box x={20} y={47} w={44} h={24} label="Auth" />
      <Connector d="M64 59 H74" head="M71 56.5 l3 2.5 l-3 2.5" />
      {/* A cylinder: the service's database. */}
      <path
        className={MINI}
        d="M76 49 a22 4 0 0 1 44 0 v18 a22 4 0 0 1 -44 0 z"
        strokeWidth="1.5"
      />
      <path
        className="stroke-(--art-ink-stroke)"
        d="M76 49 a22 4 0 0 0 44 0"
        fill="none"
        strokeWidth="1.5"
      />
      <text
        className="fill-(--art-ink-text)"
        x="98"
        y="64"
        fontSize="7"
        fontWeight="600"
        textAnchor="middle"
      >
        Users
      </text>

      {/* The selection toolbar as MultiSelectionToolbar lays it out: More | Duplicate, Save to Library | Export |
          Lock, Delete. Save to Library is under the pointer, its hover card above it. */}
      <Panel x={26} y={14} w={100} h={16} />
      <Glyph x={30} y={17} className="stroke-slate-500 dark:stroke-slate-400">
        <path d="M2.6 5 h0.1 M5 5 h0.1 M7.4 5 h0.1" strokeWidth="1.6" />
      </Glyph>
      <rect
        className="fill-slate-200 dark:fill-slate-700"
        x="42.6"
        y="17"
        width="0.6"
        height="10"
      />
      <Glyph x={46} y={17} className="stroke-slate-500 dark:stroke-slate-400">
        <rect x="3.2" y="3.2" width="5.4" height="5.4" rx="1" />
        <path d="M1.4 6.4 V2.4 a1 1 0 0 1 1 -1 h4" />
      </Glyph>
      <rect
        className="fill-sky-100 dark:fill-sky-500/25"
        x="58"
        y="16"
        width="14"
        height="12"
        rx="3"
      />
      <Glyph x={60} y={17} className="stroke-sky-700 dark:stroke-sky-200">
        <path d="M2.4 1.4 h5.2 v7.2 l-2.6 -1.8 l-2.6 1.8 z M5 3 v2.6 M3.7 4.3 h2.6" />
      </Glyph>
      <rect
        className="fill-slate-200 dark:fill-slate-700"
        x="74.6"
        y="17"
        width="0.6"
        height="10"
      />
      <Glyph x={78} y={17} className="stroke-slate-500 dark:stroke-slate-400">
        <path d="M5 6.4 V1.4 M3 3.2 l2 -2 l2 2 M1.6 6 v2.4 h6.8 V6" />
      </Glyph>
      <rect
        className="fill-slate-200 dark:fill-slate-700"
        x="90.6"
        y="17"
        width="0.6"
        height="10"
      />
      <Glyph x={94} y={17} className="stroke-slate-500 dark:stroke-slate-400">
        <rect x="2" y="4.6" width="6" height="4.2" rx="1" />
        <path d="M3.3 4.6 V3.2 a1.7 1.7 0 0 1 3.4 0 V4.6" />
      </Glyph>
      <Glyph x={108} y={17} className="stroke-slate-500 dark:stroke-slate-400">
        <path d="M1.6 2.6 h6.8 M3.8 2.6 V1.4 h2.4 v1.2 M2.6 2.6 l0.5 6 h3.8 l0.5 -6" />
      </Glyph>
      <Pointer x={67} y={25} color={YOU} />
      <g className="fa-a-pop" style={at(0.2)}>
        <rect
          className="fill-slate-900 dark:fill-slate-100"
          x="43"
          y="1"
          width="44"
          height="11"
          rx="3"
        />
        <text
          className="fill-white dark:fill-slate-900"
          x="65"
          y="8.3"
          fontSize="5.4"
          fontWeight="600"
          textAnchor="middle"
        >
          Save to Library
        </text>
      </g>
      <g className="fa-a-in" style={at(0.4)}>
        <Connector d="M132 59 H156" head="M153 56.5 l3 2.5 l-3 2.5" />
      </g>

      {/* The palette's Library (LibraryPaletteTab.tsx): search, then Personal, then each team, each group headed by
          its scope's mark, its items newest first in rows of three, each a preview over its title. */}
      <Panel x={160} y={6} w={128} h={84} />
      <rect
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        x="166"
        y="10"
        width="116"
        height="11"
        rx="3"
        strokeWidth="0.8"
      />
      <Glyph x={168.6} y={11.2} scale={0.8} className="stroke-slate-400 dark:stroke-slate-500">
        <circle cx="4.4" cy="4.4" r="2.8" />
        <path d="M6.6 6.6 l2 2" />
      </Glyph>
      <text className={MUTED} x="178" y="17.6" fontSize="5">
        Search the library
      </text>

      {/* Personal, with the person mark. */}
      <Glyph x={166} y={24.4} scale={0.5} className="stroke-slate-500 dark:stroke-slate-400">
        <circle cx="5" cy="3.4" r="2" />
        <path d="M1.6 9 a3.4 3.4 0 0 1 6.8 0" />
      </Glyph>
      <text className={TEXT} x="172.4" y="28.6" fontSize="4.8" fontWeight="600">
        Personal
      </text>
      <g transform="translate(0 -4)">
        <g className="fa-a-pop" style={at(0.6)}>
          <LibraryTile x={166} y={35} title="Auth + Users" fresh>
            <rect
              className={MINI}
              x="170"
              y="39.5"
              width="11"
              height="7"
              rx="1.5"
              strokeWidth="0.7"
            />
            <path
              className={MINI}
              d="M185 40.5 a4.5 1 0 0 1 9 0 v5 a4.5 1 0 0 1 -9 0 z"
              strokeWidth="0.7"
            />
          </LibraryTile>
        </g>
        <LibraryTile x={205} y={35} title="Retro header">
          <rect x="209" y="38.5" width="26" height="4" rx="1" fill="#0ea5e9" />
          <rect
            className="fill-slate-300 dark:fill-slate-600"
            x="209"
            y="44.5"
            width="18"
            height="2"
            rx="1"
          />
        </LibraryTile>
        <LibraryTile x={244} y={35} title="Legend">
          {['#10b981', '#f59e0b', '#ef4444'].map((c, i) => (
            <g key={c}>
              <circle cx="250" cy={39 + i * 3.6} r="1.2" fill={c} />
              <rect
                className="fill-slate-300 dark:fill-slate-600"
                x="253"
                y={38.3 + i * 3.6}
                width="16"
                height="1.4"
                rx="0.7"
              />
            </g>
          ))}
        </LibraryTile>
      </g>

      {/* Then the team's, with the people mark. */}
      <Glyph x={166} y={56.4} scale={0.5} className="stroke-slate-500 dark:stroke-slate-400">
        <circle cx="3.8" cy="3.4" r="1.8" />
        <path d="M0.8 9 a3 3 0 0 1 6 0 M6.6 1.8 a1.8 1.8 0 0 1 0 3.4 M8 6.4 a3 3 0 0 1 1.4 2.6" />
      </Glyph>
      <text className={TEXT} x="172.4" y="60.6" fontSize="4.8" fontWeight="600">
        Platform Team
      </text>
      <g transform="translate(0 -9)">
        <LibraryTile x={166} y={71} title="Service pair">
          <rect className={MINI} x="171" y="74" width="9" height="6" rx="1.2" strokeWidth="0.6" />
          <rect className={MINI} x="186" y="74" width="9" height="6" rx="1.2" strokeWidth="0.6" />
          <path className="stroke-(--art-arrow)" d="M180 77 H186" strokeWidth="0.6" />
        </LibraryTile>
        <LibraryTile x={205} y={71} title="On-call note">
          <rect x="210" y="74" width="24" height="10" rx="1" fill="#fde68a" />
        </LibraryTile>
        <LibraryTile x={244} y={71} title="Status pill">
          <rect className={MINI} x="249" y="74" width="24" height="9" rx="4.5" strokeWidth="0.6" />
        </LibraryTile>
      </g>
    </Scene>
  );
}
