// The first line of every tab view (docs/specs/024-agents/blueprints/design-views.md "The outline
// grammar", VW8, VW9, VW11).
import type { Element } from '@livedesign/design';
import type { ViewHeader, ViewName } from '@livedesign/api-schema';
import { threadOf } from './fields';
import { jsonString, plural } from './text';

type ElementCounts = ViewHeader['counts'];
export type HeaderFacts = Omit<ViewHeader, 'view'>;

export function countElements(printed: readonly Element[]): ElementCounts {
  const counts: ElementCounts = { boxes: 0, frames: 0, arrows: 0 };
  for (const el of printed) {
    if (el.type === 'arrow') counts.arrows++;
    else if (el.type === 'shape' && el.shape === 'frame') counts.frames++;
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
  const { boxes, frames, arrows } = facts.counts;
  const buckets = [
    [boxes, 'box', 'boxes'],
    [frames, 'frame', 'frames'],
    [arrows, 'arrow', 'arrows'],
  ] as const;
  const shown = buckets.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many));
  const segments = [
    `${plural(facts.elements, 'element', 'elements')}${shown.length ? `: ${shown.join(', ')}` : ''}`,
  ];
  if (facts.finish) segments.push(`finish=${facts.finish}`);
  if (facts.pages) {
    const { pages, kinds } = facts.pages;
    // A kind with no count (the wire type allows one) is left out rather than printed.
    const counted = Object.entries(kinds).filter((entry): entry is [string, number] => !!entry[1]);
    const byKind = counted.map(([kind, n]) => `${n} ${kind}`);
    // The pages whose kind is not chosen yet: counted among the pages, not by kind.
    const blank = pages - counted.reduce((sum, [, n]) => sum + n, 0);
    if (blank > 0) byKind.push(`${blank} blank`);
    segments.push(`${plural(pages, 'page', 'pages')}: ${byKind.join(', ')} (view pages)`);
  }
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
