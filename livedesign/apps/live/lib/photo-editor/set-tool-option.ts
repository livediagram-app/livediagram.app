// A tool option changed from the options flyout or a phone's options row (docs/specs/031-photo/photo-pages.md "The
// options flyout"): the person's own options take it, a crop's ratio reshapes the box in hand, and a text tool's look
// also changes the text layer being typed (or the text layer in hand).
import { setLayer, type TextSpec } from '@livedesign/photo-engine';
import { photoTools, type ToolOptions } from './tool-state';
import { reshapeCrop } from './tools/crop-tool';
import type { ToolCtx } from './tools/tool-context';

// The text tool's options that are a text layer's look.
const TEXT_KEYS: ReadonlySet<string> = new Set([
  'font',
  'size',
  'weight',
  'italic',
  'align',
  'lineHeight',
  'tracking',
]);

export function setToolOption(
  ctx: ToolCtx,
  // The text layer being typed, if any.
  typing: string | null,
  key: keyof ToolOptions,
  field: string,
  value: unknown,
): void {
  photoTools.setOptions(key, { [field]: value });
  if (key === 'crop' && field === 'ratio') reshapeCrop(ctx, value as ToolOptions['crop']['ratio']);
  if (key !== 'text' || !TEXT_KEYS.has(field)) return;
  const s = ctx.session;
  const layer = s.layer(typing ?? s.active);
  if (layer?.layerKind !== 'text') return;
  const patch: Partial<TextSpec> =
    field === 'italic' ? (value ? { italic: true } : { italic: undefined }) : { [field]: value };
  s.commitStack(
    setLayer(s.photo, layer.id, { text: { ...layer.text, ...patch } }),
    'Text',
    typing ? { undoable: false } : undefined,
  );
}
