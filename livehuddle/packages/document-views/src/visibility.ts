// The ids an arrow's pinned ends name; none for anything else.
import type { Element } from '@livehuddle/document';

export function pinnedIds(el: Element): string[] {
  if (el.type !== 'arrow') return [];
  return [el.from, el.to].flatMap((end) => (end.kind === 'pinned' ? [end.elementId] : []));
}
