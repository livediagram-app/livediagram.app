import { CHART_TYPE_LABELS, type ChartType } from '@livediagram/document';
import { conceptOutro, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { menuStep, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

// The Chart tour (docs/specs/007-editor/element-tours.md "The Chart tour"), on a selected data chart of any of the
// seven types: how it reads, a mark's readout, Grow previewed on it, its menu, and for a line, area or scatter chart its
// Chart data dialog, opened by the tour, where each step rings a real control. Done closes the dialog with the tour.

type Step = TourStepOf<ElementTourApi>;

export type ChartTourContext = MenuTourEnv & {
  type: ChartType;
  // Its numbers are read from a Sheet's range, so there is no data of its own to edit.
  fromSheet: boolean;
};

// What one mark of the chart is called.
const MARKS: Record<ChartType, [one: string, many: string]> = {
  column: ['column', 'columns'],
  bar: ['bar', 'bars'],
  line: ['point', 'points'],
  area: ['point', 'points'],
  scatter: ['point', 'points'],
  pie: ['slice', 'slices'],
  doughnut: ['slice', 'slices'],
};

// A line, area or scatter chart's numbers are a grid, edited in the Chart data dialog.
const editsInDialog = (ctx: ChartTourContext) =>
  !ctx.fromSheet && (ctx.type === 'line' || ctx.type === 'area' || ctx.type === 'scatter');

// A step inside the Chart data dialog: opens it (again, if it was closed); the engine waits for its control and
// scrolls it in.
function inDialog(id: string, title: string, body: string, target: string): Step {
  return {
    id,
    title,
    body,
    target,
    layer: 'modal',
    prepare: (api) => {
      api.clearPreview();
      api.openChartData();
    },
  };
}

// A step on the canvas: the dialog put away (a Back from it), then the step's own preview, if any.
function onCanvas(step: Step): Step {
  return {
    ...step,
    prepare: (api) => {
      api.closeChartData();
      return step.prepare?.(api);
    },
  };
}

function dataInMenu(ctx: ChartTourContext): string {
  const [one] = MARKS[ctx.type];
  if (ctx.fromSheet)
    return 'Data reads its numbers from the Sheet it was drawn from; Unlink From Sheet keeps them as its own.';
  if (editsInDialog(ctx)) return 'Data opens its numbers as a grid, which the tour opens next.';
  return `Data is a row per ${one}: a colour, a label and a value.`;
}

export function chartTourSteps(ctx: ChartTourContext): Step[] {
  const { elementId: id } = ctx;
  const [one, many] = MARKS[ctx.type];
  const typeName = CHART_TYPE_LABELS[ctx.type];
  const dialog = editsInDialog(ctx);
  return [
    onCanvas(
      onGraphic(
        'chart',
        'Sized by Value',
        `Every ${one} is drawn from a number: change the number and the chart redraws. This is a ${typeName} chart, one of seven it can be.`,
        elementSelector(id),
      ),
    ),
    ...(ctx.touch
      ? []
      : [
          onCanvas(
            onGraphic(
              'readout',
              'Point for the Number',
              `Point at a ${one} to read its label and value, with the legend on or off.`,
              elementSelector(id),
            ),
          ),
        ]),
    onCanvas(
      onGraphic(
        'animate',
        'Make It Grow',
        `Under Animation: Grow and Pop play once as it appears, Spin and Pulse loop. Grow brings the ${many} in, as here.`,
        elementSelector(id),
        'grow',
      ),
    ),
    onCanvas(
      menuStep(
        ctx,
        'menu',
        "The Chart's Own Menu",
        `Tools. Chart Type turns it into any of the seven, keeping its data. ${dataInMenu(ctx)} Chart places the legend and adds Show Values and Show Axis.`,
      ),
    ),
    ...(dialog
      ? [
          inDialog(
            'data',
            'A Row per Category',
            'Categories down the side, a column per series. Type over any number and the chart behind redraws.',
            'chart-data-table',
          ),
          inDialog(
            'series',
            'Series Across the Top',
            `Rename a series in its header or remove it with its cross. + adds another, a new ${ctx.type === 'scatter' ? 'set of points' : 'line'} on the chart.`,
            'chart-data-series',
          ),
          inDialog(
            'add-row',
            'Add a Row',
            'Puts a category at the end, every series at 0.',
            'chart-data-add-row',
          ),
          inDialog(
            'import',
            'Or Import a CSV',
            'The header row names the series, the first column the categories. It replaces the grid.',
            'chart-data-import',
          ),
        ]
      : []),
    conceptOutro(
      'That Is a Chart',
      dialog
        ? 'Every change is one undo step. Done closes the data with the tour.'
        : 'It exports exactly as drawn, and every change is one undo step.',
    ),
  ];
}
