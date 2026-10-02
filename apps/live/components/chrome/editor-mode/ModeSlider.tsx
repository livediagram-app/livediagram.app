import { CheckIcon, HoverCard, MarkerIcon } from '@livediagram/ui';
import { MODE_SWITCH_FOCUS, type EditorModeSwitchProps } from './editor-mode-copy';

// Variant D: a sliding switch labelled "Draw". On is Draw, off is Diagram.
// The whole area is the hit target; below `sm` the icon and word drop away
// and the bare track keeps the name in its aria-label. The thumb carries a
// check when on, a shape cue beside the track colour (WCAG 1.4.1).
export function ModeSlider({ mode, onChange }: EditorModeSwitchProps) {
  const draw = mode === 'draw';
  return (
    <HoverCard
      title="Draw mode"
      description={
        draw
          ? 'On: pens, the eraser and shape recognition. Switch off for Diagram mode.'
          : 'Off: you are in Diagram mode. Switch on to draw freehand.'
      }
      className="w-full"
    >
      <button
        type="button"
        role="switch"
        aria-checked={draw}
        aria-label="Draw"
        onClick={() => onChange(draw ? 'diagram' : 'draw')}
        className={`flex h-7 w-full items-center justify-center gap-1.5 rounded-md px-1.5 text-slate-700 transition-colors hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800 ${MODE_SWITCH_FOCUS}`}
      >
        <span className="hidden items-center gap-1.5 text-sm font-medium sm:flex">
          <MarkerIcon aria-hidden />
          <span className="text-optical-centre">Draw</span>
        </span>
        <span
          aria-hidden
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-micro motion-reduce:transition-none ${
            draw ? 'bg-brand-600 dark:bg-brand-500' : 'bg-slate-500'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-brand-700 shadow transition-transform duration-micro motion-reduce:transition-none ${
              draw ? 'translate-x-4' : ''
            }`}
          >
            {draw ? <CheckIcon size={10} /> : null}
          </span>
        </span>
      </button>
    </HoverCard>
  );
}
