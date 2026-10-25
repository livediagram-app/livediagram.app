// The first line of every tab view (docs/specs/024-agents/blueprints/document-views.md "The outline
// grammar", VW8, VW9, VW11).
import type { Element } from '@livedocuments/document';
import type { ViewHeader, ViewName } from '@livedocuments/api-schema';
import { threadOf } from '@liveworkspace/document-views/fields';
import { jsonString, plural } from '@liveworkspace/document-views/text';

type ElementCounts = ViewHeader['counts'];
export type HeaderFacts = Omit<ViewHeader, 'view'>;

export function countElements(printed: readonly Element[]): ElementCounts {
  const counts: ElementCounts = { boxes: 0, arrows: 0 };
  for (const el of printed) {
    if (el.type === 'arrow') counts.arrows++;
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
  const { boxes, arrows } = facts.counts;
  const buckets = [
    [boxes, 'box', 'boxes'],
    [arrows, 'arrow', 'arrows'],
  ] as const;
  const shown = buckets.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many));
  const segments = [
    `${plural(facts.elements, 'element', 'elements')}${shown.length ? `: ${shown.join(', ')}` : ''}`,
  ];
  if (facts.finish) segments.push(`finish=${facts.finish}`);
  if (facts.pages) {
    const { pages, kinds } = facts.pages;
    const byKind = Object.entries(kinds).map(([kind, n]) => `${n} ${kind}`);
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
