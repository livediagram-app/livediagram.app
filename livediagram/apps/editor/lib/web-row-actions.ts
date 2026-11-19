// The add each row-carrying element offers (docs/specs/009-elements/web-components-and-no-groups.md), on its "+" ring
// and, for a concept graphic, in its Quick Style toolbar too (owner 2026-11-19), the way a mind node offers Add Child.
export const WEB_ROW_ACTION: Partial<Record<string, { label: string; description: string }>> = {
  'stat-row': { label: 'Add Stat', description: 'Add another KPI card to the row.' },
  process: { label: 'Add Step', description: 'Add another step to the end of the process.' },
  'site-header': { label: 'Add Link', description: 'Add another link to the header.' },
  card: { label: 'Add Tag', description: 'Add a tag chip along the bottom of the card.' },
  // Concept graphics (docs/specs/009-elements/concept-graphics.md).
  'layer-stack': {
    label: 'Add Layer',
    description: 'Add another layer to the bottom of the stack.',
  },
  pyramid: { label: 'Add Tier', description: 'Add another tier to the pyramid.' },
  cycle: { label: 'Add Step', description: 'Add another step to the cycle.' },
  hub: { label: 'Add Satellite', description: 'Add another satellite round the hub.' },
  onion: { label: 'Add Ring', description: 'Add another ring round the outside.' },
  chevrons: { label: 'Add Stage', description: 'Add another stage to the end.' },
  // Missing until October 2026, so a timeline's ring offered no Add Milestone (concept-graphics.md promises one).
  'timeline-rail': { label: 'Add Milestone', description: 'Add another milestone to the end.' },
};
