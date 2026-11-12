// Feature illustration: bringing work in from other tools (the Sheets category's "Paste from Sheets
// and Excel, CSV in and out" card). Three sources, a CSV file, an Excel workbook and cells pasted
// from Google Sheets, each landing as a Sheet or a board on a tab. Motion reuses the canvas card
// timeline (fa-a-* in app/feature-art/canvas.css), which settles to the finished frame under
// reduced motion.
import { Connector, MUTED, Panel, Scene, TEXT, at } from './canvas-parts';

const SOURCES = [
  { name: 'tasks.csv', doc: 'Tasks', kind: 'Board', tint: 'fill-slate-500' },
  { name: 'budget.xlsx', doc: 'Budget', kind: 'Sheet', tint: 'fill-emerald-600' },
  // Cells pasted from Google Sheets arrive as they were copied, so they read as the range.
  { name: 'Pasted cells', doc: 'Q3 costs', kind: 'Sheet', tint: 'fill-emerald-500' },
];

const ROW_H = 22;
const Y0 = 13;

/** Files from other tools on the left, arriving as tabs of the project on the right. */
export function BoardImportArt() {
  return (
    <Scene>
      {SOURCES.map((s, i) => {
        const y = Y0 + i * ROW_H;
        return (
          <g key={s.name}>
            {/* The file, its tool's colour on the folded corner. */}
            <Panel x={22} y={y} w={92} h={16} />
            <rect className={s.tint} x="26" y={y + 4} width="6" height="8" rx="1" />
            <text className={TEXT} x="37" y={y + 10.6} fontSize="6.4" fontWeight="600">
              {s.name}
            </text>
            <g className="fa-a-in" style={at(0.2 + i * 0.25)}>
              <Connector d={`M118 ${y + 8} H 170`} head={`M166 ${y + 5} l4 3 l-4 3`} />
            </g>
            {/* The tab it becomes: a Board or a Sheet, ready to work on. */}
            <g className="fa-a-pop" style={at(0.4 + i * 0.25)}>
              <Panel x={176} y={y} w={104} h={16} />
              <rect
                className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)"
                x="181"
                y={y + 4}
                width="12"
                height="8"
                rx="2"
                strokeWidth="1"
              />
              <text className={TEXT} x="198" y={y + 10.6} fontSize="6.4" fontWeight="600">
                {s.doc}
              </text>
              <text className={MUTED} x="274" y={y + 10.6} fontSize="5.6" textAnchor="end">
                {s.kind}
              </text>
            </g>
          </g>
        );
      })}
    </Scene>
  );
}

// The four tools a board comes in from (docs/specs/026-plan/tracker-import.md), each its export file. Each tool's
// mark is drawn as a plain initial on a neutral tile: the art never borrows another product's logo.
const TOOLS = [
  { name: 'Trello', file: 'board.json' },
  { name: 'Asana', file: 'project.csv' },
  { name: 'Jira', file: 'issues.csv' },
  { name: 'Linear', file: 'issues.csv' },
];

/** A board from another tool: its export dropped on the Import dialog becomes a Board tab, cards and all. */
export function TrackerImportArt() {
  return (
    <Scene>
      {TOOLS.map((t, i) => {
        const y = 8 + i * 21;
        return (
          <g key={t.name} className="fa-a-in" style={at(i * 0.15)}>
            <Panel x={18} y={y} w={104} h={17} />
            <rect
              className="fill-slate-600 dark:fill-slate-400"
              x="23"
              y={y + 3.5}
              width="10"
              height="10"
              rx="2.5"
            />
            <text
              x="28"
              y={y + 10.6}
              fontSize="6"
              fontWeight="800"
              textAnchor="middle"
              className="fill-white dark:fill-slate-900"
            >
              {t.name[0]}
            </text>
            <text className={TEXT} x="38" y={y + 11} fontSize="6.6" fontWeight="600">
              {t.name}
            </text>
            <text className={MUTED} x="116" y={y + 11} fontSize="5.4" textAnchor="end">
              {t.file}
            </text>
          </g>
        );
      })}
      <g className="fa-a-in" style={at(0.7)}>
        <Connector d="M126 48 H 154" head="M150 45 l4 3 l-4 3" />
      </g>
      {/* The new Board tab: its columns, the cards landing in them. */}
      <g className="fa-a-pop" style={at(0.9)}>
        <Panel x={160} y={10} w={122} h={76} />
        <text className={TEXT} x="168" y="22" fontSize="6.6" fontWeight="700">
          Roadmap
        </text>
        {[0, 1, 2].map((c) => (
          <rect
            key={c}
            className="fill-slate-100 dark:fill-slate-900"
            x={166 + c * 38}
            y="28"
            width="34"
            height="52"
            rx="3"
          />
        ))}
      </g>
      {[
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
        [2, 0],
      ].map(([c, s], i) => (
        <rect
          key={i}
          className="fa-a-pop fill-white stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600"
          style={at(1.2 + i * 0.1)}
          x={169 + c! * 38}
          y={32 + s! * 16}
          width="28"
          height="12"
          rx="2"
          strokeWidth="0.6"
        />
      ))}
    </Scene>
  );
}
