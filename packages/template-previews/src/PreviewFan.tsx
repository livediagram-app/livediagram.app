import type { ComponentType, ReactNode } from 'react';

// A category drawn as a fanned stack of its first three templates' previews
// on a light plate (re-lit in dark by preview-art-tile). Hovering or focusing
// the surrounding `group` fans the stack wider. Shared by the landing page's
// folded category cards (docs/specs/019-marketing/marketing-site.md) and the editor template
// picker's category tiles (docs/specs/008-canvas/canvas-and-palette.md "Templates section"),
// so a category looks the same wherever it is offered. Each product binds it to its own
// previews (its PreviewFan, over its TemplatePreview).
// DeferredPreviewFan (DeferredPreviewFan.tsx) draws the same fan with only its front card in the first paint.

// Where each of the three previews sits in the fan, at rest and on hover.
const FAN = [
  '-translate-x-[108%] translate-y-[-44%] -rotate-6 group-hover:-translate-x-[122%] group-hover:-rotate-9 group-focus-visible:-translate-x-[122%] group-focus-visible:-rotate-9',
  '-translate-x-1/2 -translate-y-[58%] z-10 group-hover:-translate-y-[66%] group-focus-visible:-translate-y-[66%]',
  'translate-x-[8%] translate-y-[-44%] rotate-6 group-hover:translate-x-[22%] group-hover:rotate-9 group-focus-visible:translate-x-[22%] group-focus-visible:rotate-9',
];

// How many previews make the fan, and which of them sits in front (FAN's z-10 one) when there are that many.
export const FAN_SIZE = FAN.length;
export const FAN_FRONT = 1;

export type PreviewFanProps<Kind extends string> = {
  // The category's templates; the first three make the fan.
  kinds: readonly Kind[];
  // The plate's height and corner radius.
  plateClassName?: string;
  // Each fanned card's height and its preview's height inside it.
  cardClassName?: string;
};

export const DEFAULT_PLATE_CLASS = 'h-24 rounded-xl';
export const DEFAULT_CARD_CLASS = 'h-14 [&>svg]:h-10';

// The plate the cards sit on.
export function FanPlate({
  plateClassName = DEFAULT_PLATE_CLASS,
  children,
}: {
  plateClassName?: string | undefined;
  children: ReactNode;
}) {
  return (
    // Art, not a glyph framed by a control: its cards fall inside the optical audit's shape
    // size (docs/specs/004-interface-design/optical-alignment.md), so they opt out of it.
    <span
      data-optical-ignore=""
      className={`preview-art-tile relative block overflow-hidden bg-slate-50 ${plateClassName}`}
    >
      {children}
    </span>
  );
}

// One card of the fan: the `index`th of its three places. `extraClassName` adds to its classes.
export function FanCard<Kind extends string>({
  Preview,
  kind,
  index,
  cardClassName = DEFAULT_CARD_CLASS,
  extraClassName = '',
}: {
  Preview: ComponentType<{ kind: Kind }>;
  kind: Kind;
  index: number;
  cardClassName?: string | undefined;
  extraClassName?: string;
}) {
  return (
    <span
      className={`absolute left-1/2 top-1/2 flex w-[42%] items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm transition [&>svg]:w-auto ${cardClassName} ${FAN[index]} ${extraClassName}`}
    >
      <Preview kind={kind} />
    </span>
  );
}

export function PreviewFan<Kind extends string>({
  Preview,
  kinds,
  plateClassName,
  cardClassName,
}: PreviewFanProps<Kind> & {
  // The product's preview of one template (its TemplatePreview).
  Preview: ComponentType<{ kind: Kind }>;
}) {
  return (
    <FanPlate plateClassName={plateClassName}>
      {kinds.slice(0, FAN_SIZE).map((kind, i) => (
        <FanCard key={kind} Preview={Preview} kind={kind} index={i} cardClassName={cardClassName} />
      ))}
    </FanPlate>
  );
}
