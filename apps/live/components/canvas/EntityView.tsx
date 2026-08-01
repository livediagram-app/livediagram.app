'use client';

import type { EntityField, ShapeElement } from '@livediagram/diagram';

import { FIXED_FONT_PX } from '@/components/canvas/label-style';

/**
 * Height of the title bar, which has to follow the TITLE's size.
 *
 * It was a flat 30px, which is right for the default 16px label and wrong for
 * every other setting: at `lg` the title is a 32px font and simply overflowed
 * the band, so the rule cut through the text instead of sitting under it.
 *
 * Same px table the label itself uses, so the two can't disagree, times the
 * `leading-tight` line height, plus the label's own vertical padding. The 30px
 * floor keeps existing diagrams at the default size pixel-identical.
 */
export function entityHeaderHeight(element: ShapeElement): number {
  const size = element.textSize ?? 'scale';
  const fontPx = size === 'scale' ? 16 : FIXED_FONT_PX[size];
  return Math.max(30, Math.round(fontPx * 1.25) + 10);
}

// A record box (spec/120): a title bar over a list of `name: Type` rows — a
// UML class, an ER entity, a struct.
//
// The UML class template built this out of "two flush-stacked tables sharing a
// groupId… so the seam between the tables draws the attribute / method
// separator". That is a clever hack around a missing element: two elements
// pretending to be one, held together by a group, with a border seam standing
// in for a divider.
//
// The TITLE is the element's ordinary `label`, so it edits, formats and
// exports like every other label; only the rows are bespoke.

export function EntityView({
  element,
  textColor,
  fontFamily,
}: {
  element: ShapeElement;
  textColor: string;
  fontFamily: string | undefined;
}) {
  const fields = element.entityFields ?? [];
  const rule = element.strokeColor ?? '#cbd5e1';
  return (
    // Inert as a whole: the canvas owns press-drag on an element, and nothing
    // here is a control. Rows are edited from the context menu, like a
    // checklist's (spec/83).
    <div
      className="pointer-events-none absolute inset-0 flex flex-col overflow-hidden rounded-[inherit]"
      style={{ fontFamily }}
    >
      {/* The title bar's height is the label's business — this is just the
          rule under it, drawn where the label ends. */}
      <div
        className="shrink-0"
        style={{ height: entityHeaderHeight(element), borderBottom: `1px solid ${rule}` }}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-[3px] overflow-hidden px-2 py-1.5">
        {fields.length === 0 ? (
          <span className="text-[10px] italic opacity-40" style={{ color: textColor }}>
            No fields yet
          </span>
        ) : (
          fields.map((f, i) => <Row key={i} field={f} color={textColor} />)
        )}
      </div>
    </div>
  );
}

function Row({ field, color }: { field: EntityField; color: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1 text-[11px] leading-tight" style={{ color }}>
      <span className="min-w-0 truncate">{field.name}</span>
      {field.type ? (
        // The type is muted and pushed right: scanning a class is scanning the
        // NAMES, and a full-strength type column competes with them.
        <span className="ml-auto shrink-0 truncate text-[10px] opacity-55">{field.type}</span>
      ) : null}
    </div>
  );
}
