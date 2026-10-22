// The Services stack as an agent built it, kept as data: node ids its own slugs and arrow ids
// minted as slugs (docs/specs/024-agents/blueprints/document-views.md "Testing", VW7).
import { slugIdFor, type Element, type Tab } from '@livedocuments/document';
import services from './agent-built-services.json';

function slugArrows(elements: readonly Element[]): Element[] {
  const taken = new Set(elements.filter((el) => el.type !== 'arrow').map((el) => el.id));
  return elements.map((el) => {
    if (el.type !== 'arrow') return el;
    const id = slugIdFor(el.label ?? '', 'arrow', taken);
    taken.add(id);
    return { ...el, id };
  });
}

export function agentBuiltTab(): Tab {
  const tab = structuredClone(services) as unknown as Tab;
  return { ...tab, elements: slugArrows(tab.elements) };
}
