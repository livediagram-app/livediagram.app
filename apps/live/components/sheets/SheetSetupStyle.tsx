'use client';

// Setup Sheet's last step, Style (docs/specs/029-sheets/sheet.md "Setup Sheet"): an option row per look with a small
// drawn preview, Freeze Header Row (not for Blank), and the cell size.
import type { SheetCellSize, SheetLook } from '@livediagram/sheets';
import { SwitchRow } from '@/components/primitives/SwitchRow';
import { OptionRows } from '@/components/plan/OptionRows';
import type { PlanPalette } from '@/components/plan/plan-palette';

export const LOOKS: readonly { id: SheetLook; label: string; hint: string }[] = [
  { id: 'header', label: 'Header', hint: 'A bold, tinted first row' },
  { id: 'banded', label: 'Banded', hint: 'And every other row tinted' },
  { id: 'boxed', label: 'Boxed', hint: 'And a border round each cell' },
  { id: 'minimal', label: 'Minimal', hint: 'Bold first row, no gridlines' },
  { id: 'plain', label: 'Plain', hint: 'No fills or borders' },
];

const SIZES: readonly { id: SheetCellSize; label: string; hint: string }[] = [
  { id: 'compact', label: 'Compact', hint: '100 by 24, to see more at once' },
  { id: 'default', label: 'Default', hint: '120 by 28' },
  { id: 'roomy', label: 'Roomy', hint: '160 by 36, easier to read and tap' },
];

const HEADING = 'text-[11px] font-semibold uppercase tracking-wider';

// A look drawn small, each look's one trait made plain: Header's solid header row; Banded's striped rows; Boxed's
// border round every cell; Minimal's bold header with no gridlines at all; Plain's bare grid, header like any row.
function LookPreview({ look, palette }: { look: SheetLook; palette: PlanPalette }) {
  const head = look === 'header' || look === 'banded' || look === 'boxed';
  const bold = look !== 'plain';
  const W = 96;
  const H = 56;
  const rowH = H / 4;
  const colW = W / 3;
  const brand = 'var(--color-brand-500)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-9 w-full" aria-hidden>
      {/* Fills: the header row, then Banded's stripes. */}
      {head ? <rect x={0} y={0} width={W} height={rowH} fill={brand} fillOpacity={0.55} /> : null}
      {look === 'banded'
        ? [2].map((r) => (
            <rect
              key={r}
              x={0}
              y={r * rowH}
              width={W}
              height={rowH}
              fill={brand}
              fillOpacity={0.22}
            />
          ))
        : null}
      {/* Lines: Boxed's strong border round each cell, the faint grid of Header, Banded and Plain; none for Minimal. */}
      {look === 'minimal'
        ? null
        : [1, 2, 3].map((r) => (
            <line
              key={`h${r}`}
              x1={0}
              x2={W}
              y1={r * rowH}
              y2={r * rowH}
              stroke={look === 'boxed' ? palette.text : palette.cardBorder}
              strokeOpacity={look === 'boxed' ? 0.7 : 1}
              strokeWidth={look === 'boxed' ? 1.2 : 0.8}
            />
          ))}
      {look === 'minimal'
        ? null
        : [1, 2].map((c) => (
            <line
              key={`v${c}`}
              x1={c * colW}
              x2={c * colW}
              y1={0}
              y2={H}
              stroke={look === 'boxed' ? palette.text : palette.cardBorder}
              strokeOpacity={look === 'boxed' ? 0.7 : 1}
              strokeWidth={look === 'boxed' ? 1.2 : 0.8}
            />
          ))}
      {look === 'boxed' ? (
        <rect
          x={0.6}
          y={0.6}
          width={W - 1.2}
          height={H - 1.2}
          fill="none"
          stroke={palette.text}
          strokeOpacity={0.7}
          strokeWidth={1.2}
        />
      ) : null}
      {/* Text: the header row's bold (thick, bright), the rest plain. */}
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`t${r}-${c}`}
            x={c * colW + 5}
            y={r * rowH + (r === 0 && bold ? 4.5 : 5.5)}
            width={r === 0 ? 18 : 10 + ((r + c) % 3) * 4}
            height={r === 0 && bold ? 5 : 3}
            rx={1.5}
            fill={r === 0 && head ? '#ffffff' : palette.text}
            opacity={r === 0 && bold ? 0.95 : 0.35}
          />
        )),
      )}
    </svg>
  );
}

export function SheetSetupStyle({
  palette,
  look,
  onLook,
  freeze,
  onFreeze,
  size,
  onSize,
  hasRows,
}: {
  palette: PlanPalette;
  look: SheetLook;
  onLook: (l: SheetLook) => void;
  freeze: boolean;
  onFreeze: (on: boolean) => void;
  size: SheetCellSize;
  onSize: (s: SheetCellSize) => void;
  // A start with rows (Blank has none, so only gridlines and sizes apply).
  hasRows: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1.5" aria-labelledby="setup-sheet-look">
        <h3 id="setup-sheet-look" className={HEADING} style={{ color: palette.muted }}>
          Look
        </h3>
        <OptionRows
          kind="single"
          label="Look"
          palette={palette}
          selected={look}
          onPick={(id) => onLook(id as SheetLook)}
          rows={LOOKS.map((l) => ({
            id: l.id,
            label: l.label,
            detail: l.hint,
            icon: (
              <span
                className="block w-14 overflow-hidden rounded-md border"
                style={{ borderColor: palette.cardBorder }}
              >
                <LookPreview look={l.id} palette={palette} />
              </span>
            ),
          }))}
        />
      </section>
      <section className="flex flex-col gap-1.5" aria-labelledby="setup-sheet-size">
        <h3 id="setup-sheet-size" className={HEADING} style={{ color: palette.muted }}>
          Cell Size
        </h3>
        <OptionRows
          kind="single"
          label="Cell Size"
          palette={palette}
          selected={size}
          onPick={(id) => onSize(id as SheetCellSize)}
          rows={SIZES.map((x) => ({ id: x.id, label: x.label, detail: x.hint }))}
        />
      </section>
      {hasRows ? (
        <div className="flex flex-col gap-2 border-t pt-4" style={{ borderColor: palette.border }}>
          <SwitchRow checked={freeze} onChange={onFreeze} className="cursor-pointer">
            <span className="block text-[13px] font-semibold" style={{ color: palette.text }}>
              Freeze Header Row
            </span>
            <span className="block text-[12px]" style={{ color: palette.muted }}>
              The first row stays put while the rest scrolls.
            </span>
          </SwitchRow>
        </div>
      ) : null}
    </div>
  );
}
