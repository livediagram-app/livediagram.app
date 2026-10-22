// The tool in hand made into its handler (docs/specs/031-photo/photo-tools.md). Alt held with a
// painting or filling tool picks a colour as the Eyedropper does; an open Free Transform takes every
// press until it is committed or cancelled.
import { photoTools, type PhotoToolId } from '../tool-state';
import { cropTool } from './crop-tool';
import { bucketTool, eyedropperTool, gradientTool, pickColour } from './fill-tools';
import { moveTool } from './move-tool';
import { redEyeTool, spotHealTool, strokeTool } from './paint-tools';
import { selectTool } from './select-tools';
import { shapeTool } from './shape-tools';
import { textTool } from './text-tool';
import type { ToolCtx } from './tool-context';
import type { ToolHandler } from './tool-handler';
import { freeTransform, transformHandler } from './transform-tool';

// The tools whose Alt-press picks a colour.
const ALT_PICKS: ReadonlySet<PhotoToolId> = new Set([
  'brush',
  'pencil',
  'bucket',
  'gradient',
  'rectangle',
  'ellipse',
  'line',
  'text',
]);

function baseHandler(tool: PhotoToolId, ctx: ToolCtx): ToolHandler {
  switch (tool) {
    case 'move':
      return moveTool(ctx);
    case 'rect-select':
    case 'ellipse-select':
    case 'lasso':
    case 'polygon-lasso':
    case 'magnetic-lasso':
    case 'quick-select':
    case 'magic-wand':
      return selectTool(tool, ctx);
    case 'crop':
      return cropTool(ctx);
    case 'eyedropper':
      return eyedropperTool(ctx);
    case 'spot-heal':
      return spotHealTool(ctx);
    case 'red-eye':
      return redEyeTool(ctx);
    case 'bucket':
      return bucketTool(ctx);
    case 'gradient':
      return gradientTool(ctx);
    case 'text':
      return textTool(ctx);
    case 'rectangle':
    case 'ellipse':
    case 'line':
      return shapeTool(tool, ctx);
    default:
      return strokeTool(tool, ctx);
  }
}

/** The handler for a tool, made once per tool taken in hand. */
export function toolHandler(tool: PhotoToolId, ctx: ToolCtx): ToolHandler {
  const base = baseHandler(tool, ctx);
  const transform = transformHandler(ctx);
  let picking: ToolHandler | null = null;
  let current: ToolHandler = base;
  const pick = (p: { x: number; y: number }) => {
    const o = ctx.state().options.eyedropper;
    const colour = pickColour(ctx, p, o.sample, o.sampleAll);
    if (colour) photoTools.set({ foreground: colour });
  };
  return {
    get cursor() {
      return freeTransform.get() ? 'move' : base.cursor;
    },
    down(p) {
      if (freeTransform.get()) {
        current = transform;
        return transform.down(p);
      }
      if (p.alt && ALT_PICKS.has(tool)) {
        picking ??= eyedropperTool(ctx);
        current = picking;
        pick(p);
        return picking.down(p);
      }
      current = base;
      return base.down(p);
    },
    move(p) {
      current.move?.(p);
    },
    up(p) {
      current.up?.(p);
      current = base;
    },
    double(p) {
      current.double?.(p);
    },
    key(key, e) {
      if (freeTransform.get()) return transform.key?.(key, e) ?? false;
      return base.key?.(key, e) ?? false;
    },
    cancel() {
      current.cancel?.();
      base.cancel?.();
    },
  } satisfies ToolHandler;
}
