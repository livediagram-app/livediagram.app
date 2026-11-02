// The board grid (docs/specs/008-canvas/canvas-and-palette.md "Templates", the use-case batch): one layout for the
// boards that are tinted panels of sticky notes in a grid, drawn from data (template-board-grid-data.ts). A bold
// title over a muted how-to; an optional session rail (the question, a timer and a dot vote, how it runs); the
// panels, each a retro-kit column (a deep-hue header, a glyph, a prompt and notes in its hue); optional axis words
// over the columns and down the rows; and an optional closing panel whose checklist is what the board produces.
//
// Panels, headers, prompts and axis words are the scaffold layer; the title, notes, tools and checklists the content.
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createText, type Element } from '@livediagram/document';
import { BOARD_GRIDS, type BoardGrid, type BoardGridKind } from './template-board-grid-data';
import {
  actionChecklist,
  actionsPanel,
  checklistHeight,
  CONTENT,
  railNote,
  RETRO,
  RETRO_HUES,
  RETRO_INK,
  RETRO_MUTED,
  retroHeader,
  retroHeading,
  retroNotesTop,
  retroPanel,
  SCAFFOLD,
  sessionButtons,
  stickyGrid,
  stickyGridHeight,
} from './template-retro-kit';

const AXIS_W = 44;
const AXIS_H = 34;
const QUESTION_H = 150;
// A closing panel this wide splits a checklist of four or more in two, so a list never stretches across the board.
const SPLIT_CLOSING_AT = 1000;

export function buildBoardGrid(kind: BoardGridKind, cx: number, cy: number): Element[] {
  return layoutBoardGrid(BOARD_GRIDS[kind], cx, cy);
}

function layoutBoardGrid(grid: BoardGrid, cx: number, cy: number): Element[] {
  const { gap, pad, railW, titleH, subtitleH, headGap, stickyGap } = RETRO;
  const mostNotes = Math.max(...grid.panels.map((p) => p.notes.length));
  const panelH = retroNotesTop(0) + stickyGridHeight(mostNotes, grid.noteCols, grid.noteH) + pad;
  const rows = Math.ceil(grid.panels.length / grid.columns);
  const gridW = grid.columns * grid.panelW + (grid.columns - 1) * gap;
  const gridH = rows * panelH + (rows - 1) * gap;
  const closing = grid.closing;
  const closingCols = closing && closing.items.length >= 4 && gridW >= SPLIT_CLOSING_AT ? 2 : 1;
  const closingRows = closing ? Math.ceil(closing.items.length / closingCols) : 0;
  const closingH = closing ? retroNotesTop(0) + checklistHeight(closingRows) + pad : 0;
  const bodyH = gridH + (closing ? gap + closingH : 0);

  const railSpan = grid.rail ? railW + gap : 0;
  const axisW = grid.axes ? AXIS_W : 0;
  const axisH = grid.axes ? AXIS_H : 0;
  const totalW = railSpan + axisW + gridW;
  const totalH = titleH + subtitleH + headGap + axisH + bodyH;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const gridX = x0 + railSpan + axisW;
  const top = y0 + titleH + subtitleH + headGap + axisH;

  const elements: Element[] = [...retroHeading(x0, y0, totalW, grid.title, grid.howTo)];

  if (grid.rail) {
    const rail = grid.rail;
    const buttonsY = top + QUESTION_H + 20;
    const stepsY = buttonsY + RETRO.buttonH + 24;
    elements.push(
      {
        ...createShape('square', x0, top),
        width: railW,
        height: QUESTION_H,
        label: rail.question,
        textSize: 'md',
        textBold: true,
        textColor: RETRO_INK,
        fillColor: '#ffffff',
        strokeColor: '#94a3b8',
        ...CONTENT,
      },
      ...sessionButtons(x0, buttonsY, railW, rail),
      // On the canvas rather than a light panel, so the theme inks it.
      {
        ...createText(x0, stepsY),
        width: railW,
        height: 36,
        label: 'How it runs',
        textSize: 'md',
        textBold: true,
        textAlignX: 'left',
        ...SCAFFOLD,
      },
      railNote(x0, stepsY + 44, railW, top + bodyH - (stepsY + 44), rail.steps.join('\n')),
    );
  }

  // The axis words: one over each column, one down each row (turned to run along it).
  if (grid.axes) {
    const axisWord = (x: number, y: number, w: number, label: string, rotation?: number) =>
      elements.push({
        ...createText(x, y),
        width: w,
        height: AXIS_H - 6,
        label,
        textSize: 'sm',
        textBold: true,
        textColor: RETRO_MUTED,
        textAlignX: 'center',
        ...(rotation ? { rotation } : {}),
        ...SCAFFOLD,
      });
    grid.axes.top.forEach((word, c) =>
      axisWord(gridX + c * (grid.panelW + gap), top - AXIS_H, grid.panelW, word),
    );
    grid.axes.side.forEach((word, r) =>
      axisWord(
        x0 + railSpan + AXIS_W / 2 - panelH / 2 - 3,
        top + r * (panelH + gap) + panelH / 2 - (AXIS_H - 6) / 2,
        panelH,
        word,
        -90,
      ),
    );
  }

  grid.panels.forEach((panel, i) => {
    const hue = RETRO_HUES[panel.hue];
    const x = gridX + (i % grid.columns) * (grid.panelW + gap);
    const y = top + Math.floor(i / grid.columns) * (panelH + gap);
    elements.push(
      retroPanel(x, y, grid.panelW, panelH, hue),
      ...retroHeader(x, y, grid.panelW, panel.label, panel.hint, panel.icon, hue.headerColor),
      ...stickyGrid(
        x + pad,
        retroNotesTop(y),
        grid.panelW - pad * 2,
        grid.noteH,
        grid.noteCols,
        panel.notes,
        hue.sticky,
        stickyGap,
      ),
    );
  });

  if (closing) {
    const y = top + gridH + gap;
    const listW = (gridW - pad * 2 - (closingCols - 1) * gap) / closingCols;
    elements.push(
      actionsPanel(gridX, y, gridW, closingH),
      ...retroHeader(gridX, y, gridW, closing.label, closing.hint, 'check-circle', RETRO_INK),
    );
    for (let c = 0; c < closingCols; c++) {
      const from = c * closingRows;
      elements.push(
        actionChecklist(
          gridX + pad + c * (listW + gap),
          retroNotesTop(y),
          listW,
          closing.items.slice(from, from + closingRows),
          (closing.done ?? []).slice(from, from + closingRows),
        ),
      );
    }
  }

  return elements;
}
