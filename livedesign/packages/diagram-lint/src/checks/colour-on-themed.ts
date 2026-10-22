// `colour-on-themed` (info): a fill or stroke set by hex that the tab's theme would not paint, on an
// element the theme colours, bound to no preset or swatch (LN17). Stickies, images, link cards and videos
// have no theme fields; a colour stored by name (a marker colour) is a binding. A custom theme is not
// known here: the check is skipped and logged (N15).

import { endpointPosition, themeColourFields, type Element } from '@livepages/document';
import { refOf } from '../context';
import { fixes } from '../fixes';
import { themeColourSet, type ColourField } from '../theme-colours';
import type { Check } from './types';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// The layer a layered template's scaffold sits on (@livepages/templates template-layers.ts).
const TEMPLATE_SCAFFOLD_LAYER = 'layer:template:scaffold';

const FIELDS: readonly { field: ColourField; alias: 'fill' | 'stroke'; swatch: string }[] = [
  { field: 'fillColor', alias: 'fill', swatch: 'fillSwatch' },
  { field: 'strokeColor', alias: 'stroke', swatch: 'strokeSwatch' },
];

function offTheme(theme: string | undefined, el: Element): ('fill' | 'stroke')[] | null {
  const themed = new Set(themeColourFields(el).map((f) => f.element));
  const bound = Reflect.get(el, 'colorPreset') !== undefined;
  const out: ('fill' | 'stroke')[] = [];
  for (const { field, alias, swatch } of FIELDS) {
    const value: unknown = Reflect.get(el, field);
    if (!themed.has(field) || bound || typeof value !== 'string' || !HEX.test(value)) continue;
    if (Reflect.get(el, swatch) !== undefined) continue;
    const painted = themeColourSet(theme, el, field);
    if (!painted) return null;
    if (!painted.has(value.toLowerCase())) out.push(alias);
  }
  return out;
}

// A mind map's nodes and connectors wear their branch's hue on purpose (docs/specs/009-elements/mind-node.md): the
// colour is which branch it is, not a stray override.
function mindMapColoured(el: Element, mindNodes: ReadonlySet<string>): boolean {
  if (el.type === 'shape') return el.shape === 'mind-node';
  if (el.type !== 'arrow') return false;
  return [el.from, el.to].every((end) => end.kind === 'pinned' && mindNodes.has(end.elementId));
}

export const colourOnThemed: Check = (ctx) => {
  const findings = [];
  const mindNodes = new Set(
    ctx.visible.filter((el) => el.type === 'shape' && el.shape === 'mind-node').map((el) => el.id),
  );
  for (const el of ctx.visible) {
    if (mindMapColoured(el, mindNodes)) continue;
    // A write is judged on the colours it set, not on those a template or a person set before it.
    if (ctx.coloured && !ctx.coloured.has(el.id)) continue;
    // A template's scaffold (its board, axes and headings) is coloured by its design, not by the agent.
    if (Reflect.get(el, 'layerId') === TEMPLATE_SCAFFOLD_LAYER) continue;
    const fields = offTheme(ctx.theme, el);
    if (fields === null) {
      ctx.log('[lint] theme unresolved', {});
      return [];
    }
    if (fields.length === 0) continue;
    const ref = refOf(ctx, el.id);
    findings.push({
      code: 'colour-on-themed' as const,
      refs: [ref],
      message: `${ref} sets its ${fields.join(' and ')} on a themed tab`,
      fix: fixes.colourOnThemed(ctx.source, ref, fields),
      at: el.type === 'arrow' ? endpointPosition(el.from, ctx.index) : { x: el.x, y: el.y },
    });
  }
  return findings;
};
