'use client';

// The rules' layer over the cells (docs/specs/029-sheets/data-validation.md, conditional-formatting.md): a Plain Text
// dropdown's arrow on the active cell, the option list open on a cell, the anchor a panel opened from a menu sits
// against (the active cell), and the rule panels themselves (the Data Validation editor, the Conditional Formatting
// popover, the Custom Number Format popover).
import { lazy, Suspense, useState } from 'react';
import { Tooltip, lucideGlyph } from '@livediagram/ui';
import { lucideChevronDown } from '@livediagram/icons/lucide';
import { cellKey, displayValue, formatA1, validationRuleAt } from '@livediagram/sheets';
import { cellBox, mergeAt } from '../sheet-geometry';
import { useSheetController } from '../sheet-controller';
import type { SheetActions } from '../useSheetActions';
import { RULE_ARROW_PX } from './sheet-rule-draw';
import { SheetDropdownList } from './SheetDropdownList';
import { SheetCellSlot } from '../SheetCellSlot';

const ChevronGlyph = lucideGlyph(lucideChevronDown, 13);
const SheetValidationEditor = lazy(() =>
  import('./SheetValidationEditor').then((m) => ({ default: m.SheetValidationEditor })),
);
const SheetFormatRules = lazy(() =>
  import('./SheetFormatRules').then((m) => ({ default: m.SheetFormatRules })),
);
const SheetCustomFormat = lazy(() =>
  import('./SheetCustomFormat').then((m) => ({ default: m.SheetCustomFormat })),
);

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function SheetRuleLayer({ actions }: { actions: SheetActions }) {
  const c = useSheetController();
  // The active cell's corner, which a dropdown's list and a panel opened from a menu sit against.
  const [cellAnchor, setCellAnchor] = useState<HTMLSpanElement | null>(null);
  const [dropAnchor, setDropAnchor] = useState<HTMLSpanElement | null>(null);
  if (!c.interactive) return null;
  const { active } = c.selection;
  const g = c.geometry;
  const box = cellBox(g, active.r, active.c, c.scroll, mergeAt(g, active.r, active.c));
  const rule = c.sheet.layout.rules?.length
    ? validationRuleAt(c.sheet.layout, active.r, active.c)
    : null;
  const plainArrow =
    c.canEdit &&
    !c.editing &&
    rule &&
    (rule.is === 'list' || rule.is === 'range') &&
    rule.show === 'plain';
  const open = c.rules.dropdown;
  const openRule = open ? validationRuleAt(c.sheet.layout, open.r, open.c) : null;
  const openBox = open ? cellBox(g, open.r, open.c, c.scroll, mergeAt(g, open.r, open.c)) : null;
  const panel = c.rules.panel;
  const panelAnchor = panel ? (panel.anchor === 'cell' ? cellAnchor : panel.anchor) : null;
  const closePanel = () => {
    c.rules.setPanel(null);
    c.rules.setFormatPreview(null);
    c.focusGrid();
  };
  const currentAt = (at: { r: number; c: number }) => {
    const rowId = c.sheet.layout.rows[at.r]!;
    const colId = c.sheet.layout.cols[at.c]!;
    return displayValue(
      c.workbook.value(c.sheet.id, at.r, at.c),
      c.sheet.cells.get(cellKey(rowId, colId))?.format,
      c.locale,
    ).text;
  };
  return (
    <>
      <span
        ref={setCellAnchor}
        aria-hidden
        className="pointer-events-none absolute"
        style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      />
      {openBox ? (
        <span
          ref={setDropAnchor}
          aria-hidden
          className="pointer-events-none absolute"
          style={{ left: openBox.x, top: openBox.y, width: openBox.w, height: openBox.h }}
        />
      ) : null}
      {plainArrow ? (
        <SheetCellSlot r={active.r} c={active.c}>
          <Tooltip label={`Options for ${formatA1(active.r, active.c)}`}>
            <button
              type="button"
              aria-label={`Options for ${formatA1(active.r, active.c)}`}
              aria-haspopup="listbox"
              aria-expanded={!!open}
              className="absolute z-[8] flex h-5 w-5 cursor-pointer items-center justify-center rounded transition hover:opacity-80"
              style={{
                left: box.x + box.w - RULE_ARROW_PX + 1,
                top: box.y + (box.h - 20) / 2,
                backgroundColor: c.palette.column,
                color: c.palette.text,
              }}
              onPointerDown={stop}
              onClick={() => actions.openDropdown()}
            >
              <ChevronGlyph />
            </button>
          </Tooltip>
        </SheetCellSlot>
      ) : null}
      {open && openRule && dropAnchor && (openRule.is === 'list' || openRule.is === 'range') ? (
        <SheetDropdownList
          c={c}
          rule={openRule}
          at={open}
          anchor={dropAnchor}
          current={currentAt(open)}
          onPick={(v) => actions.pickOption(open, v)}
          onClose={() => {
            c.rules.setDropdown(null);
            c.focusGrid();
          }}
        />
      ) : null}
      {panel && panelAnchor ? (
        <Suspense fallback={null}>
          {panel.kind === 'validation' ? (
            <SheetValidationEditor
              actions={actions}
              anchor={panelAnchor}
              ruleId={panel.ruleId}
              fresh={panel.start === 'list'}
              onClose={closePanel}
            />
          ) : panel.kind === 'format' ? (
            <SheetFormatRules
              actions={actions}
              anchor={panelAnchor}
              ruleId={panel.ruleId}
              all={panel.all}
              onClose={closePanel}
            />
          ) : (
            <SheetCustomFormat actions={actions} anchor={panelAnchor} onClose={closePanel} />
          )}
        </Suspense>
      ) : null}
    </>
  );
}
