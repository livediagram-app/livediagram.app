// Activity-Panel-category illustrations (docs/specs/018-help/help-app.md): the per-tab change log with
// who/what/when entries, jump-to-element, clear history, plus undo / redo /
// revert controls. Composed only from the shared primitives so the house style
// holds; the panel scene is reused across articles with small variations.

import { Scene, Panel, Button, Avatar, Label } from './primitives';

type Tone = 'brand' | 'emerald' | 'violet' | 'amber' | 'rose' | 'slate';

interface Row {
  initial: string;
  colour: Tone;
  what: string;
  when: string;
}

const DEFAULT_ROWS: Row[] = [
  { initial: 'Y', colour: 'brand', what: 'Added a Square', when: 'just now' },
  { initial: 'A', colour: 'emerald', what: 'Moved an Arrow', when: '2 min ago' },
  { initial: 'Y', colour: 'brand', what: 'Recoloured', when: '5 min ago' },
  { initial: 'M', colour: 'violet', what: 'Renamed', when: '8 min ago' },
];

/** A small circular icon button (undo / redo arrow) at the panel header. */
function ArrowButton({
  cx,
  cy,
  dir,
  muted = false,
}: {
  cx: number;
  cy: number;
  dir: 'undo' | 'redo';
  muted?: boolean;
}) {
  const stroke = muted ? 'stroke-slate-300' : 'stroke-brand-500';
  // Hook arrows matching the editor's Undo / Redo controls (apps/live
  // ActivityPanel UndoIcon / RedoIcon): a shaft that curves back on itself with
  // a chevron head. Authored in the editor's 16-unit space and re-centred on the
  // button (translate -8, scale ~0.82 → the glyph's (8,8) centre lands at the
  // origin and the ~11-unit glyph sits comfortably inside the r=9 circle).
  const body =
    dir === 'undo'
      ? 'M3.5 6.5h6.75A3.25 3.25 0 0 1 13.5 9.75v0a3.25 3.25 0 0 1 -3.25 3.25H6'
      : 'M12.5 6.5H5.75A3.25 3.25 0 0 0 2.5 9.75v0A3.25 3.25 0 0 0 5.75 13H10';
  const head = dir === 'undo' ? 'M6 3.5L3 6.5L6 9.5' : 'M10 3.5L13 6.5L10 9.5';
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle
        r={9}
        className={`fill-white ${muted ? 'stroke-slate-200' : 'stroke-brand-300'}`}
        strokeWidth={1.5}
      />
      <g transform="translate(-6.56 -6.56) scale(0.82)">
        <path
          d={body}
          fill="none"
          className={stroke}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={head}
          fill="none"
          className={stroke}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

/** One change row: avatar dot + "what" label + relative "when". */
function ActivityRow({
  x,
  y,
  w,
  row,
  highlight,
}: {
  x: number;
  y: number;
  w: number;
  row: Row;
  highlight?: 'select' | 'revert';
}) {
  return (
    <g>
      {highlight === 'select' && (
        <rect x={x} y={y} width={w} height={28} rx={6} className="fill-brand-50" />
      )}
      {highlight === 'revert' && (
        <rect
          x={x}
          y={y}
          width={w}
          height={28}
          rx={6}
          className="fill-amber-50 stroke-amber-300"
          strokeWidth={1.5}
        />
      )}
      <Avatar cx={x + 16} cy={y + 14} r={9} initial={row.initial} colour={row.colour} />
      <Label x={x + 32} y={y + 11} size={10} weight={600} tone="strong">
        {row.what}
      </Label>
      <Label x={x + 32} y={y + 22} size={8} tone="muted">
        {row.when}
      </Label>
    </g>
  );
}

/** The Activity panel surface, reused across articles. Pass `rows`, an optional
 *  highlighted row index (and how), and toggles for the per-row trailing
 *  control and the header buttons. */
function ActivityPanel({
  rows = DEFAULT_ROWS,
  highlightIndex = -1,
  highlightKind = 'select',
  rowTrailing,
  redoMuted = true,
  footer,
}: {
  rows?: Row[];
  highlightIndex?: number;
  highlightKind?: 'select' | 'revert';
  rowTrailing?: (i: number) => 'jump' | 'revert' | undefined;
  redoMuted?: boolean;
  footer?: 'clear' | 'status';
}) {
  const px = 28;
  const py = 18;
  const pw = 264;
  const ph = 204;
  const rowX = px + 14;
  const rowW = pw - 28;
  const firstRowY = py + 36;
  return (
    <Scene w={420} h={240} bg="canvas">
      <Panel x={px} y={py} w={pw} h={ph} title="ACTIVITY">
        {/* Undo / redo at the header, right side */}
        <ArrowButton cx={px + pw - 46} cy={py + 11} dir="undo" />
        <ArrowButton cx={px + pw - 20} cy={py + 11} dir="redo" muted={redoMuted} />
        {rows.map((row, i) => {
          const ry = firstRowY + i * 32;
          const trailing = rowTrailing?.(i);
          return (
            <g key={i}>
              <ActivityRow
                x={rowX}
                y={ry}
                w={rowW}
                row={row}
                highlight={i === highlightIndex ? highlightKind : undefined}
              />
              {trailing === 'jump' && (
                <g transform={`translate(${rowX + rowW - 16} ${ry + 14})`}>
                  <path
                    d="M-4 4 L4 -4 M0 -4 H4 V0"
                    fill="none"
                    className="stroke-brand-500"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}
              {trailing === 'revert' && (
                <g transform={`translate(${rowX + rowW - 36} ${ry + 3})`}>
                  <rect
                    width={32}
                    height={18}
                    rx={5}
                    className="fill-white stroke-amber-400"
                    strokeWidth={1.5}
                  />
                  <Label
                    x={16}
                    y={10}
                    anchor="middle"
                    size={8}
                    weight={700}
                    className="fill-amber-600"
                  >
                    Revert
                  </Label>
                </g>
              )}
            </g>
          );
        })}
        {footer === 'clear' && (
          <Button
            x={px + pw - 96}
            y={py + ph - 34}
            w={84}
            h={20}
            label="Clear Activity"
            variant="ghost"
          />
        )}
        {footer === 'status' && (
          <>
            <circle cx={rowX + 5} cy={py + ph - 20} r={4} className="fill-emerald-500" />
            <Label x={rowX + 16} y={py + ph - 19} size={10} weight={600} tone="muted">
              Saving…
            </Label>
          </>
        )}
      </Panel>
    </Scene>
  );
}

/** The panel as it first appears: the running who/what/when list with a status
 *  line at the foot. Used by "What it is". */
export function ActivityOverview() {
  return <ActivityPanel footer="status" />;
}

/** Reading entries: one row selected (jump-to-element), trailing jump arrows,
 *  a Clear Activity control. Used by "How it works". */
export function ActivityEntries() {
  return (
    <ActivityPanel
      highlightIndex={1}
      highlightKind="select"
      rowTrailing={(i) => (i === 1 ? 'jump' : undefined)}
      footer="clear"
    />
  );
}

/** Undo: the most recent change being stepped back, with the Cmd/Ctrl+Z key. */
export function UndoStep() {
  return (
    <Scene w={420} h={240} bg="canvas">
      <Panel x={28} y={18} w={264} h={186} title="ACTIVITY">
        <ArrowButton cx={28 + 264 - 46} cy={18 + 11} dir="undo" />
        <ArrowButton cx={28 + 264 - 20} cy={18 + 11} dir="redo" muted />
        {/* Top row fading out as it is undone */}
        <g opacity={0.4}>
          <Avatar cx={42 + 16} cy={54 + 14} r={9} initial="Y" colour="brand" />
          <Label x={42 + 32} y={54 + 11} size={10} weight={600} tone="muted">
            Added a Square
          </Label>
          <Label x={42 + 32} y={54 + 22} size={8} tone="muted">
            just now
          </Label>
          <path d="M52 66 L256 80" className="stroke-slate-300" strokeWidth={1.5} />
        </g>
        {[
          { i: 'A', c: 'emerald' as Tone, w: 'Moved an Arrow', t: '2 min ago' },
          { i: 'Y', c: 'brand' as Tone, w: 'Recoloured', t: '5 min ago' },
        ].map((r, i) => {
          const ry = 90 + i * 32;
          return (
            <g key={i}>
              <Avatar cx={42 + 16} cy={ry + 14} r={9} initial={r.i} colour={r.c} />
              <Label x={42 + 32} y={ry + 11} size={10} weight={600} tone="strong">
                {r.w}
              </Label>
              <Label x={42 + 32} y={ry + 22} size={8} tone="muted">
                {r.t}
              </Label>
            </g>
          );
        })}
      </Panel>
      {/* Keyboard shortcut */}
      <g transform="translate(312 96)">
        <rect
          width={40}
          height={26}
          rx={6}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={20} y={14} anchor="middle" size={10} weight={700} tone="body">
          ⌘ Z
        </Label>
        <Label x={20} y={42} anchor="middle" size={9} tone="muted">
          Undo
        </Label>
      </g>
    </Scene>
  );
}

/** Redo: a previously undone change being re-applied, with the key. */
export function RedoStep() {
  return (
    <Scene w={420} h={240} bg="canvas">
      <Panel x={28} y={18} w={264} h={186} title="ACTIVITY">
        <ArrowButton cx={28 + 264 - 46} cy={18 + 11} dir="undo" muted />
        <ArrowButton cx={28 + 264 - 20} cy={18 + 11} dir="redo" />
        {/* Top row coming back as it is redone */}
        <g>
          <rect x={42} y={54} width={236} height={28} rx={6} className="fill-brand-50" />
          <Avatar cx={42 + 16} cy={54 + 14} r={9} initial="Y" colour="brand" />
          <Label x={42 + 32} y={54 + 11} size={10} weight={600} tone="accent">
            Added a Square
          </Label>
          <Label x={42 + 32} y={54 + 22} size={8} tone="muted">
            just now
          </Label>
        </g>
        {[
          { i: 'A', c: 'emerald' as Tone, w: 'Moved an Arrow', t: '2 min ago' },
          { i: 'Y', c: 'brand' as Tone, w: 'Recoloured', t: '5 min ago' },
        ].map((r, i) => {
          const ry = 90 + i * 32;
          return (
            <g key={i}>
              <Avatar cx={42 + 16} cy={ry + 14} r={9} initial={r.i} colour={r.c} />
              <Label x={42 + 32} y={ry + 11} size={10} weight={600} tone="strong">
                {r.w}
              </Label>
              <Label x={42 + 32} y={ry + 22} size={8} tone="muted">
                {r.t}
              </Label>
            </g>
          );
        })}
      </Panel>
      <g transform="translate(312 90)">
        <rect
          width={56}
          height={26}
          rx={6}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={28} y={14} anchor="middle" size={10} weight={700} tone="body">
          ⌘ ⇧ Z
        </Label>
        <Label x={28} y={42} anchor="middle" size={9} tone="muted">
          Redo
        </Label>
      </g>
    </Scene>
  );
}

/** Reverting: one specific past row is being cancelled while later rows stay. */
export function RevertStep() {
  const rows: Row[] = [
    { initial: 'Y', colour: 'brand', what: 'Added a Square', when: 'just now' },
    { initial: 'A', colour: 'emerald', what: 'Moved an Arrow', when: '2 min ago' },
    { initial: 'M', colour: 'violet', what: 'Recoloured', when: '5 min ago' },
    { initial: 'Y', colour: 'brand', what: 'Renamed', when: '8 min ago' },
  ];
  return (
    <ActivityPanel
      rows={rows}
      highlightIndex={2}
      highlightKind="revert"
      rowTrailing={(i) => (i === 2 ? 'revert' : undefined)}
    />
  );
}
