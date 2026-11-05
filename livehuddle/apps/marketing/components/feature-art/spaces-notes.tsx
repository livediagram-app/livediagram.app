// Feature illustrations for working on a Space together (docs/specs/019-marketing/marketing-site.md "Feature category
// pages"): the Virtual Office's notes wall with one note picked, commented on, assigned or moved back, and a Space
// small in a card for where it is kept and who else sees it. Split from ./spaces (the rooms in use) by subject.

import type { CSSProperties, ReactNode } from 'react';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import { FONT } from '../art-tokens';
import { TEAM_POD, roomHref } from '../hero-space-cast';
import { OFFICE } from '../hero-space-places';
import { SpaceShot, at } from './space-shot';

const OFFICE_WALL = [-320, -90, 420, 140] as const;

/** The office's notes wall with one sticky singled out, for the cards about working on a note together. */
function WallShot({ children }: { children?: ReactNode }) {
  return (
    <SpaceShot spec={OFFICE} box={OFFICE_WALL}>
      {children}
    </SpaceShot>
  );
}

// The wall's second sticky ("Cake"), the one each card singles out.
const NOTE = { x: -214, y: -8, size: 70 };

/** See what others are working on: Kit's colour glowing round the note they picked, their initials on its corner. */
export function SelectedNoteArt() {
  return (
    <WallShot>
      <g className="fa-a-pop" style={at(0.4)}>
        <rect
          x={NOTE.x - 4}
          y={NOTE.y - 4}
          width={NOTE.size + 8}
          height={NOTE.size + 8}
          rx={4}
          fill="none"
          stroke="#14b8a6"
          strokeWidth={3}
          style={{ filter: 'drop-shadow(0 0 5px rgb(20 184 166 / 0.7))' }}
        />
        <rect
          x={NOTE.x + NOTE.size - 18}
          y={NOTE.y - 16}
          width={26}
          height={16}
          rx={4}
          fill="#14b8a6"
        />
        <text
          x={NOTE.x + NOTE.size - 5}
          y={NOTE.y - 4}
          fontFamily={FONT}
          fontSize={10}
          fontWeight={700}
          fill="#fff"
          textAnchor="middle"
        >
          KT
        </text>
      </g>
    </WallShot>
  );
}

/** Comments on any element: a thread pinned to a note, with a reply. */
export function NoteCommentArt() {
  const x = NOTE.x + NOTE.size + 16;
  return (
    <WallShot>
      <circle
        cx={NOTE.x + NOTE.size}
        cy={NOTE.y}
        r={9}
        fill="#ec4899"
        className="fa-a-pop"
        style={at(0.2)}
      />
      <g className="fa-a-pop" style={at(0.6)}>
        <rect
          x={x}
          y={NOTE.y - 34}
          width={200}
          height={102}
          rx={8}
          className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        />
        <text
          x={x + 12}
          y={NOTE.y - 10}
          fontFamily={FONT}
          fontSize={11}
          fontWeight={700}
          fill="#ec4899"
        >
          Priya
        </text>
        <text
          x={x + 12}
          y={NOTE.y + 6}
          fontFamily={FONT}
          fontSize={11}
          className="fill-slate-700 dark:fill-slate-200"
        >
          Lemon or chocolate? 🍋
        </text>
        <text
          x={x + 12}
          y={NOTE.y + 24}
          fontFamily={FONT}
          fontSize={11}
          className="fill-slate-500 dark:fill-slate-400"
        >
          @Maya both, obviously
        </text>
        <rect
          x={x + 12}
          y={NOTE.y + 36}
          width={176}
          height={20}
          rx={6}
          className="fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
        />
        <text x={x + 20} y={NOTE.y + 50} fontFamily={FONT} fontSize={10} className="fill-slate-400">
          Reply
        </text>
      </g>
    </WallShot>
  );
}

/** Assign actions to teammates: a note turned into an action for Maya, due Friday. */
export function NoteActionArt() {
  const x = NOTE.x + NOTE.size + 16;
  return (
    <WallShot>
      <g className="fa-a-pop" style={at(0.5)}>
        <rect
          x={x}
          y={NOTE.y - 34}
          width={190}
          height={102}
          rx={8}
          className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        />
        <text
          x={x + 12}
          y={NOTE.y - 4}
          fontFamily={FONT}
          fontSize={9}
          fontWeight={700}
          letterSpacing={1}
          className="fill-violet-600 dark:fill-violet-300"
        >
          ACTION
        </text>
        <text
          x={x + 12}
          y={NOTE.y + 12}
          fontFamily={FONT}
          fontSize={12}
          fontWeight={600}
          className="fill-slate-800 dark:fill-slate-100"
        >
          Order the cake
        </text>
        <circle cx={x + 18} cy={NOTE.y + 25} r={5} fill="#10b981" />
        <text
          x={x + 28}
          y={NOTE.y + 29}
          fontFamily={FONT}
          fontSize={10}
          className="fill-slate-600 dark:fill-slate-300"
        >
          Maya · Due Friday
        </text>
        <rect
          x={x + 13}
          y={NOTE.y + 41}
          width={10}
          height={10}
          rx={2}
          fill="none"
          strokeWidth={1.2}
          className="stroke-slate-400"
        />
        <text
          x={x + 28}
          y={NOTE.y + 50}
          fontFamily={FONT}
          fontSize={10}
          className="fill-slate-500 dark:fill-slate-400"
        >
          Mark done
        </text>
      </g>
    </WallShot>
  );
}

/** Undo and redo: the note you just moved, back where it was. */
export function NoteUndoArt() {
  return (
    <WallShot>
      <rect
        x={NOTE.x + 30}
        y={NOTE.y - 30}
        width={NOTE.size}
        height={NOTE.size}
        rx={3}
        fill="none"
        strokeDasharray="5 5"
        strokeWidth={2}
        className="fa-a-in stroke-slate-400"
        style={at(0.3)}
      />
      <g transform={`translate(${NOTE.x + NOTE.size + 60} ${NOTE.y + 14})`}>
        <g className="fa-a-pop" style={at(0.7)}>
          <rect
            width={64}
            height={30}
            rx={8}
            className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
          />
          <path
            d="M14 15 a8 8 0 1 1 3 6 M14 9 v6 h6"
            fill="none"
            strokeWidth={2}
            className="stroke-slate-700 dark:stroke-slate-200"
          />
          <path
            d="M50 15 a8 8 0 1 0 -3 6 M50 9 v6 h-6"
            fill="none"
            strokeWidth={2}
            className="stroke-slate-400"
          />
        </g>
      </g>
    </WallShot>
  );
}

/** A Space small in a card, for the cards about where a Space is kept and who else sees it. */
function Thumb({ x, y, w, label }: { x: number; y: number; w: number; label: string }) {
  const h = w * (TEAM_POD.stage.height / TEAM_POD.stage.width);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        width={w + 12}
        height={h + 30}
        rx={8}
        className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
      />
      <svg
        x={6}
        y={6}
        width={w}
        height={h}
        viewBox={`${TEAM_POD.stage.x} ${TEAM_POD.stage.y} ${TEAM_POD.stage.width} ${TEAM_POD.stage.height}`}
      >
        <rect
          x={TEAM_POD.stage.x}
          y={TEAM_POD.stage.y}
          width={TEAM_POD.stage.width}
          height={TEAM_POD.stage.height}
          className="fill-(--art-paper)"
        />
        <image
          href={roomHref(TEAM_POD, 'light')}
          x={TEAM_POD.stage.x}
          y={TEAM_POD.stage.y}
          width={TEAM_POD.stage.width}
          height={TEAM_POD.stage.height}
          className="dark:hidden"
        />
        <image
          href={roomHref(TEAM_POD, 'dark')}
          x={TEAM_POD.stage.x}
          y={TEAM_POD.stage.y}
          width={TEAM_POD.stage.width}
          height={TEAM_POD.stage.height}
          className="hidden dark:inline"
        />
      </svg>
      <text
        x={8}
        y={h + 23}
        fontFamily={FONT}
        fontSize={11}
        fontWeight={600}
        className="fill-slate-700 dark:fill-slate-200"
      >
        {label}
      </text>
    </g>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <Frame canvas>
      <svg
        viewBox="0 0 300 96"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
      >
        {children}
      </svg>
    </Frame>
  );
}

/** Keep a Space in This Browser: the Team Pod, kept here, with its This Browser badge. */
export function BrowserSpaceArt() {
  return (
    <Panel>
      <Thumb x={70} y={8} w={120} label="Team Pod" />
      <g className="fa-a-pop" style={at(0.5)}>
        <rect
          x={150}
          y={64}
          width={86}
          height={18}
          rx={9}
          className="fill-slate-700 dark:fill-slate-200"
        />
        <text
          x={193}
          y={76.5}
          fontFamily={FONT}
          fontSize={9}
          fontWeight={700}
          textAnchor="middle"
          className="fill-white dark:fill-slate-900"
        >
          This Browser
        </text>
      </g>
    </Panel>
  );
}

/** A copy in your Google Drive: the Space travelling into a Drive folder as its file. */
export function DriveCopyArt() {
  return (
    <Panel>
      <Thumb x={24} y={8} w={110} label="Team Pod" />
      <path
        d="M156 44 h34 m-10 -8 l10 8 l-10 8"
        fill="none"
        strokeWidth={2.5}
        strokeDasharray="4 4"
        className="fa-a-draw stroke-slate-400"
        style={{ '--len': 60, '--d': '0.3s' } as CSSProperties}
      />
      <g className="fa-a-pop" style={at(0.8)}>
        <path
          d="M204 26 h24 l6 7 h40 v42 h-70 z"
          className="fill-sky-100 stroke-sky-500 dark:fill-sky-950"
          strokeWidth={1.5}
        />
        <text
          x={239}
          y={58}
          fontFamily={FONT}
          fontSize={9}
          fontWeight={600}
          textAnchor="middle"
          className="fill-sky-800 dark:fill-sky-200"
        >
          Team Pod.json
        </text>
      </g>
    </Panel>
  );
}

/** Share a Space with the Community: its card in the gallery, filed under Offices & Spaces, with its likes. */
export function CommunitySpaceArt() {
  return (
    <Panel>
      <Thumb x={78} y={6} w={116} label="Stand-up Pod" />
      <g className="fa-a-pop" style={at(0.6)}>
        <rect x={176} y={62} width={70} height={18} rx={9} className="fill-emerald-600" />
        <text
          x={211}
          y={74.5}
          fontFamily={FONT}
          fontSize={9}
          fontWeight={700}
          textAnchor="middle"
          fill="#fff"
        >
          ♥ 24 likes
        </text>
      </g>
    </Panel>
  );
}

/** Bring your AI tools: your AI asked for a stand-up pod, and the Space it set up. */
export function AiSpaceArt() {
  return (
    <Panel>
      <g className="fa-a-in" style={at(0.1)}>
        <rect x={14} y={14} width={130} height={30} rx={10} className="fill-violet-600" />
        <text x={24} y={33} fontFamily={FONT} fontSize={9.5} fontWeight={600} fill="#fff">
          Set up our stand-up pod
        </text>
      </g>
      <g className="fa-a-pop" style={at(0.6)}>
        <rect
          x={14}
          y={52}
          width={130}
          height={22}
          rx={8}
          className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        />
        <text
          x={24}
          y={67}
          fontFamily={FONT}
          fontSize={8.5}
          className="fill-emerald-700 dark:fill-emerald-300"
        >
          ✓ livehuddle.create_document
        </text>
      </g>
      <g className="fa-a-pop" style={at(1)}>
        <Thumb x={158} y={10} w={118} label="Stand-up Pod" />
      </g>
    </Panel>
  );
}
