// The first line of every tab view (docs/specs/024-agents/blueprints/document-views.md "The outline
// grammar", VW8, VW9, VW11).
import type { Element } from '@livediagram/document';
import type { ViewHeader, ViewName } from '@livediagram/api-schema';
import { threadOf } from './fields';
import { jsonString, plural } from './text';

export type ElementCounts = ViewHeader['counts'];
export type HeaderFacts = Omit<ViewHeader, 'view'>;

export function countElements(printed: readonly Element[]): ElementCounts {
  const counts: ElementCounts = { boxes: 0, frames: 0, lanes: 0, arrows: 0 };
  for (const el of printed) {
    if (el.type === 'arrow') counts.arrows++;
    else if (el.type === 'shape' && el.shape === 'frame') counts.frames++;
    else if (el.type === 'shape' && el.shape === 'lane') counts.lanes++;
    else counts.boxes++;
  }
  return counts;
}

export function threadCounts(printed: readonly Element[]): ViewHeader['threads'] {
  const threads = printed.flatMap((el) => {
    const thread = threadOf(el);
    return thread === null ? [] : [thread];
  });
  return { open: threads.filter((t) => !t.resolved).length, total: threads.length };
}

export function viewHeader(view: ViewName, facts: HeaderFacts): ViewHeader {
  return { view, ...facts };
}

// Everything after the tab's name, ` · `-joined; `overview` reuses it on each tab line.
export function headerSegments(facts: HeaderFacts): string {
  const { boxes, frames, lanes, arrows } = facts.counts;
  const buckets = [
    [boxes, 'box', 'boxes'],
    [frames, 'frame', 'frames'],
    [lanes, 'lane', 'lanes'],
    [arrows, 'arrow', 'arrows'],
  ] as const;
  const shown = buckets.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many));
  const segments = [
    `${plural(facts.elements, 'element', 'elements')}${shown.length ? `: ${shown.join(', ')}` : ''}`,
  ];
  if (facts.tab.kind !== 'diagram') segments.push(`kind=${facts.tab.kind}`);
  if (facts.hidden > 0) segments.push(`${facts.hidden} hidden`);
  if (facts.unknown > 0) segments.push(`${facts.unknown} unknown`);
  if (facts.threads.total > 0)
    segments.push(`threads ${facts.threads.open} open/${facts.threads.total}`);
  if (facts.rev !== null) segments.push(`rev ${facts.rev}`);
  return segments.join(' · ');
}

export function headerLine(facts: HeaderFacts): string {
  return `tab ${facts.tab.ref} ${jsonString(facts.tab.name)} · ${headerSegments(facts)}`;
}
