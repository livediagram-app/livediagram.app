import { CHART_TYPE_LABELS, type ChartType, withArticle } from '@livedesign/design';
import { conceptOutro, onGraphic } from './concept-element-tour-steps';
import type { ElementTourApi } from './element-tour-api';
import { menuStep, type MenuTourEnv } from './menu-tour-step';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// The Chart tour (docs/specs/007-editor/element-tours.md "The Chart tour"), on a selected data chart of any of the
// seven types: how it reads, a mark's readout, Grow previewed on it, its menu, and for a line, area or scatter chart its
// Chart Data dialog, opened by the tour, where each step rings a real control. Done closes the dialog with the tour.

type Step = TourStepOf<ElementTourApi>;

export type ChartTourContext = MenuTourEnv & {
  type: ChartType;
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

// A line, area or scatter chart's numbers are a grid, edited in the Chart Data dialog.
const editsInDialog = (ctx: ChartTourContext) =>
  ctx.type === 'line' || ctx.type === 'area' || ctx.type === 'scatter';

// A step inside the Chart Data dialog: opens it (again, if it was closed); the engine waits for its control and
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
        `Each ${one} is a number: change it and the chart redraws. This is ${withArticle(typeName)} chart.`,
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
              `Point at a ${one} to read its value.`,
              elementSelector(id),
            ),
          ),
        ]),
    onCanvas(
      onGraphic(
        'animate',
        'Make It Grow',
        `Animation makes it grow, pop, spin or pulse. Grow brings the ${many} in, as here.`,
        elementSelector(id),
        'grow',
      ),
    ),
    onCanvas(
      menuStep(
        ctx,
        'menu',
        "The Chart's Own Menu",
        `Tools › Chart Type switches the kind of chart and keeps the data. ${dataInMenu(ctx)}`,
        ['Tools', 'Chart Type'],
      ),
    ),
    ...(dialog
      ? [
          inDialog(
            'data',
            'A Row per Category',
            'Type over any number and the chart redraws.',
            'chart-data-table',
          ),
          inDialog(
            'series',
            'Series Across the Top',
            `Rename a series in its header, or remove it. + adds a new ${ctx.type === 'scatter' ? 'set of points' : 'line'}.`,
            'chart-data-series',
          ),
          inDialog('add-row', 'Add a Row', 'Adds a row at the end.', 'chart-data-add-row'),
          inDialog(
            'import',
            'Or Import a CSV',
            'Paste a table to replace the data. The first row names the series.',
            'chart-data-import',
          ),
        ]
      : []),
    conceptOutro(
      'That Is a Chart',
      dialog
        ? 'Undo takes back any change. Done closes the data.'
        : 'It exports as you see it. Undo takes back any change.',
    ),
  ];
}
