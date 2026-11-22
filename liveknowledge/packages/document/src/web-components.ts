// One copy for every product: @liveworkspace/element-model/web-components.
export * from '@liveworkspace/element-model/web-components';
import {
  isWebComponentShape as isSharedWebComponentShape,
  statRowLayout as sharedStatRowLayout,
  type StatRowLayout,
  type WebComponentShape as SharedWebComponentShape,
} from '@liveworkspace/element-model/web-components';

// liveknowledge' web components: the shared ones and the Quote (docs/specs/009-elements/quote.md).
export type WebComponentShape = SharedWebComponentShape | 'quote';

export function isWebComponentShape(kind: string): kind is WebComponentShape {
  return kind === 'quote' || isSharedWebComponentShape(kind);
}

// A stat in liveknowledge (docs/specs/009-elements/stat-row.md): its value, what it counts and, optionally, how it
// moved. Only liveknowledge stores a change (the shared StatWithChange, spelled out so the api schema names it StatItem).
export type StatItem = { value: string; caption: string; change?: string };

// liveknowledge' stat row (docs/specs/009-elements/stat-row.md): a one-stat tile reads as a headline, so its value
// grows to 96 px (raised from the shared 72, which the other products keep).
export const STAT_VALUE_MAX_PX = 96;

/** The stat row's layout in liveknowledge: the shared one, with the headline value size and, when any stat of the
 *  row carries one, a change line. */
export function statRowLayout(
  width: number,
  height: number,
  count: number,
  hasChange = false,
): StatRowLayout {
  return sharedStatRowLayout(width, height, count, { hasChange, valueMaxPx: STAT_VALUE_MAX_PX });
}
