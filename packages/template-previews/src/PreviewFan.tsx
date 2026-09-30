import type { TemplateKind } from '@livediagram/templates';
import { TemplatePreview } from './template-preview';

// A category drawn as a fanned stack of its first three templates' previews
// on a light plate (re-lit in dark by preview-art-tile). Hovering or focusing
// the surrounding `group` fans the stack wider. Shared by the landing page's
// folded category cards (docs/specs/019-marketing/marketing-site.md) and the editor template
// picker's category tiles (docs/specs/008-canvas/canvas-and-palette.md "Templates section"),
// so a category looks the same wherever it is offered.

// Where each of the three previews sits in the fan, at rest and on hover.
const FAN = [
  '-translate-x-[108%] translate-y-[-44%] -rotate-6 group-hover:-translate-x-[122%] group-hover:-rotate-9 group-focus-visible:-translate-x-[122%] group-focus-visible:-rotate-9',
  '-translate-x-1/2 -translate-y-[58%] z-10 group-hover:-translate-y-[66%] group-focus-visible:-translate-y-[66%]',
  'translate-x-[8%] translate-y-[-44%] rotate-6 group-hover:translate-x-[22%] group-hover:rotate-9 group-focus-visible:translate-x-[22%] group-focus-visible:rotate-9',
];

export function PreviewFan({
  kinds,
  plateClassName = 'h-24 rounded-xl',
  cardClassName = 'h-14 [&>svg]:h-10',
}: {
  // The category's templates; the first three make the fan.
  kinds: readonly TemplateKind[];
  // The plate's height and corner radius.
  plateClassName?: string;
  // Each fanned card's height and its preview's height inside it.
  cardClassName?: string;
}) {
  return (
    <span
      className={`preview-art-tile relative block overflow-hidden bg-slate-50 ${plateClassName}`}
    >
      {kinds.slice(0, 3).map((kind, i) => (
        <span
          key={kind}
          className={`absolute left-1/2 top-1/2 flex w-[42%] items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm transition [&>svg]:w-auto ${cardClassName} ${FAN[i]}`}
        >
          <TemplatePreview kind={kind} />
        </span>
      ))}
    </span>
  );
}
