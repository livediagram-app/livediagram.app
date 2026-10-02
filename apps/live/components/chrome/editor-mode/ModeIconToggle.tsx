import { HoverCard, MarkerIcon } from '@livediagram/ui';
import { MODE_SWITCH_FOCUS, type EditorModeSwitchProps } from './editor-mode-copy';

// Variant B: a single 28px icon toggle, the pen-mode idiom. Pressed is Draw,
// unpressed is Diagram. The name stays "Draw mode" in both states; only
// aria-pressed and the pressed styling (tint, border, corner dot) change.
export function ModeIconToggle({ mode, onChange }: EditorModeSwitchProps) {
  const draw = mode === 'draw';
  return (
    <HoverCard
      title={`Draw mode: ${draw ? 'on' : 'off'}`}
      description={
        draw
          ? 'Pens, the eraser and shape recognition. Press for Diagram mode.'
          : 'Press to draw freehand with pens and shape recognition.'
      }
      className="w-full"
    >
      <button
        type="button"
        aria-pressed={draw}
        aria-label="Draw mode"
        onClick={() => onChange(draw ? 'diagram' : 'draw')}
        className={`relative flex h-7 w-full items-center justify-center rounded-md border transition-colors ${MODE_SWITCH_FOCUS} ${
          draw
            ? 'border-brand-600 bg-brand-100 text-brand-700 dark:border-brand-400 dark:bg-brand-500/20 dark:text-brand-200'
            : 'border-transparent text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
        }`}
      >
        <MarkerIcon aria-hidden />
        {draw ? (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-brand-600 dark:bg-brand-400"
          />
        ) : null}
      </button>
    </HoverCard>
  );
}
