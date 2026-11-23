// The inline-icon placement picker of the context menu: a cross of direction cells round the label. One copy for
// every editor (their context-menu-input-rows hold the rest).
import { DirArrow } from './context-menu-icons';
import { type IconPosition } from '@liveworkspace/model-core/basics';
import { onMouseHover } from '../primitives/hover-preview';

// The inline-icon placement picker laid out as a cross (Top / Left / Right /
// Bottom around an empty centre), each cell an arrow + label.
export function IconPositionGrid({
  current,
  onPick,
  onPreview,
  onPreviewEnd,
}: {
  current: string;
  onPick: (pos: IconPosition) => void;
  // Optional hover-preview pair (docs/specs/010-palette/style-presets.md flow): hovering a cell shows the
  // icon on that side live, leaving reverts.
  onPreview?: (pos: IconPosition) => void;
  onPreviewEnd?: () => void;
}) {
  const cell = (key: IconPosition, label: string, dir: 'up' | 'down' | 'left' | 'right') => (
    <button
      type="button"
      aria-pressed={current === key}
      onClick={() => onPick(key)}
      onPointerEnter={onPreview ? onMouseHover(() => onPreview(key)) : undefined}
      onPointerLeave={onPreviewEnd ? onMouseHover(onPreviewEnd) : undefined}
      className={`flex items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition ${
        current === key
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      <DirArrow dir={dir} />
      {label}
    </button>
  );
  return (
    <div className="grid grid-cols-3 gap-1 px-2 pb-1.5">
      <span />
      {cell('above', 'Top', 'up')}
      <span />
      {cell('left', 'Left', 'left')}
      <span />
      {cell('right', 'Right', 'right')}
      <span />
      {cell('below', 'Bottom', 'down')}
      <span />
    </div>
  );
}
