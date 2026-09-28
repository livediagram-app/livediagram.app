import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import { createShape } from './factories';
import type { ShapeElement, Tab } from './index';

// The Agenda exports the way the canvas draws it (docs/specs/020-import-export/export-fidelity.md,
// docs/specs/012-collaboration/agenda.md "The face").

const agenda = (overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  ...(createShape('agenda', 0, 0) as ShapeElement),
  strokeColor: '#0ea5e9',
  label: 'Sprint review',
  agendaItems: [
    { label: 'Welcome', minutes: 5 },
    { label: 'Demo', minutes: 15 },
    { label: 'Metrics', minutes: 10 },
  ],
  ...overrides,
});
const svgOf = (el: ShapeElement) =>
  renderElementsToSvg({ id: 't', name: 'T', elements: [el] } as unknown as Tab);

describe('Agenda export', () => {
  it('writes every step with its minutes and the run time', () => {
    const svg = svgOf(agenda());
    for (const s of ['Sprint review', '30M', 'Welcome', 'Demo', 'Metrics', '15m'])
      expect(svg).toContain(s);
  });

  it('strikes finished steps, and lights the current one in the accent with its minutes large', () => {
    const svg = svgOf(agenda({ agendaCurrent: 1 }));
    expect(svg).toMatch(/text-decoration="line-through"[^>]*>Welcome</);
    expect(svg).not.toMatch(/text-decoration="line-through"[^>]*>Demo</);
    expect(svg).toMatch(/font-size="15" font-weight="700" fill="#0ea5e9"[^>]*>15m</);
    // The progress bar: the finished five minutes of thirty, in the accent.
    expect(svg).toMatch(/<rect[^>]*fill="#0ea5e9" fill-opacity="1"/);
  });

  it('has no progress to show before a session starts', () => {
    const svg = svgOf(agenda());
    expect(svg).not.toMatch(/text-decoration="line-through"/);
    expect(svg).not.toMatch(/font-size="15" font-weight="700"/);
  });

  it('invites segments when there are none', () => {
    expect(svgOf(agenda({ agendaItems: [] }))).toContain('No segments yet');
  });
});
