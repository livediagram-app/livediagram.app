// Configure Board (docs/specs/026-plan/plan-board.md "Configure"): the panel the bottom-right Board button opens on a
// Board tab, its Suggested for This Board presets and its Fine-Tune tiles. The words are the editor's own
// (BoardConfigureDialog, board-presets.ts).

import { Scene, Label } from '@liveworkspace/help-site/art/primitives';

const W = 520;
const PANEL_X = 20;
const PANEL_W = W - 40;
const CARD_W = (PANEL_W - 24 - 16) / 3;

const PRESETS: readonly { title: string; detail: string; reason?: string; active?: boolean }[] = [
  { title: 'Simple Columns', detail: 'Just the columns.', active: true },
  { title: 'Compact Overview', detail: 'Small cards and no rows.' },
  {
    title: 'By Person',
    detail: 'A row for each person.',
    reason: '5 of 8 cards have someone on them',
  },
];

const TILES: readonly { title: string; now: string }[] = [
  { title: 'Columns', now: '4 columns' },
  { title: 'Swimlanes', now: 'No rows' },
  { title: 'Sort Cards', now: 'In the order you put them' },
  { title: 'Supported Cards', now: 'All 3 card types' },
  { title: 'Card Layout', now: 'Detailed cards' },
];

// A preset's little drawing: three columns, the one this board is now inked in the accent.
function PresetArt({ x, y, active }: { x: number; y: number; active: boolean }) {
  const ink = active ? 'fill-brand-300' : 'fill-slate-300';
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={34}
        height={26}
        rx={4}
        className={active ? 'fill-white' : 'fill-slate-100'}
      />
      {[0, 1, 2].map((c) => (
        <rect
          key={c}
          x={x + 4 + c * 10}
          y={y + 5}
          width={7}
          height={c === 1 ? 12 : 16}
          rx={1.5}
          className={ink}
        />
      ))}
    </g>
  );
}

/** The Configure Board panel above the bottom-right cluster, the Board button pressed beside Style. */
export function PlanConfigureBoardScene() {
  const top = 12;
  const presetsY = top + 56;
  const tilesY = presetsY + 80;
  const panelH = tilesY + 2 * 40 + 10 - top;
  const clusterY = top + panelH + 12;
  return (
    <Scene w={W} h={clusterY + 40}>
      <rect
        x={PANEL_X}
        y={top}
        width={PANEL_W}
        height={panelH}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={PANEL_X + 14} y={top + 20} size={12.5} weight={700} tone="strong">
        Configure Board
      </Label>
      <Label x={PANEL_X + 14} y={top + 36} size={9} tone="muted">
        Start from a layout that suits your cards, then fine-tune any part of it.
      </Label>
      <rect
        x={PANEL_X + PANEL_W - 104}
        y={top + 10}
        width={76}
        height={20}
        rx={6}
        className="fill-slate-100"
      />
      <Label
        x={PANEL_X + PANEL_W - 66}
        y={top + 20}
        size={9}
        weight={600}
        tone="body"
        anchor="middle"
      >
        Create Form
      </Label>
      <Label x={PANEL_X + PANEL_W - 14} y={top + 20} size={11} tone="muted" anchor="end">
        ×
      </Label>

      <Label x={PANEL_X + 14} y={presetsY - 6} size={7.5} weight={600} tone="muted">
        SUGGESTED FOR THIS BOARD
      </Label>
      {PRESETS.map((p, i) => {
        const x = PANEL_X + 12 + i * (CARD_W + 8);
        return (
          <g key={p.title}>
            <rect
              x={x}
              y={presetsY}
              width={CARD_W}
              height={64}
              rx={8}
              className={
                p.active ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'
              }
              strokeWidth={1.2}
            />
            <PresetArt x={x + 8} y={presetsY + 8} active={!!p.active} />
            <Label x={x + 48} y={presetsY + 15} size={8.5} weight={600} tone="strong">
              {p.title}
            </Label>
            <Label x={x + 8} y={presetsY + 44} size={7.5} tone="muted">
              {p.detail}
            </Label>
            {p.reason ? (
              <Label x={x + 8} y={presetsY + 55} size={7} weight={600} tone="body">
                {p.reason}
              </Label>
            ) : null}
          </g>
        );
      })}

      <Label x={PANEL_X + 14} y={tilesY - 6} size={7.5} weight={600} tone="muted">
        FINE-TUNE
      </Label>
      {TILES.map((t, i) => {
        const x = PANEL_X + 12 + (i % 3) * (CARD_W + 8);
        const y = tilesY + Math.floor(i / 3) * 40;
        return (
          <g key={t.title}>
            <rect
              x={x}
              y={y}
              width={CARD_W}
              height={32}
              rx={7}
              className="fill-white stroke-slate-200"
              strokeWidth={0.75}
            />
            <rect x={x + 7} y={y + 7} width={18} height={18} rx={4} className="fill-slate-100" />
            <Label x={x + 32} y={y + 12} size={9} weight={600} tone="strong">
              {t.title}
            </Label>
            <Label x={x + 32} y={y + 23} size={7.5} tone="muted">
              {t.now}
            </Label>
          </g>
        );
      })}

      {/* The bottom-right cluster: Board, pressed, joined to the left of Style. */}
      <rect
        x={W - 150}
        y={clusterY}
        width={130}
        height={28}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <rect x={W - 148} y={clusterY + 2} width={64} height={24} rx={6} className="fill-brand-100" />
      <Label x={W - 116} y={clusterY + 14} size={9.5} weight={600} tone="accent" anchor="middle">
        Board
      </Label>
      <line
        x1={W - 84}
        x2={W - 84}
        y1={clusterY + 5}
        y2={clusterY + 23}
        className="stroke-slate-200"
      />
      <Label x={W - 52} y={clusterY + 14} size={9.5} weight={600} tone="body" anchor="middle">
        Style
      </Label>
    </Scene>
  );
}
