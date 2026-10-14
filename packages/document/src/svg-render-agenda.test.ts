import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import { agendaFitHeight } from './svg-render-agenda';
import { buildTab } from './tab-builders';
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
  it('wraps a long step name over two lines rather than cutting it to one', () => {
    const name = 'Review the roadmap and agree owners';
    const svg = svgOf(agenda({ agendaItems: [{ label: name, minutes: 10 }] }));
    for (const word of name.split(' ')) expect(svg).toContain(word);
    expect(svg).not.toContain('…');
  });

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

describe('agendaFitHeight', () => {
  const eight = Array.from({ length: 8 }, (_, i) => ({ label: `Step ${i + 1}`, minutes: 15 }));

  it('is tall enough to draw every segment, where a shorter card leaves the last off', () => {
    const short = agenda({ width: 360, height: 300, agendaItems: eight });
    expect(svgOf(short)).not.toContain('Step 8');
    const fitted = agendaFitHeight(short);
    expect(fitted).toBeGreaterThan(300);
    expect(svgOf({ ...short, height: fitted })).toContain('Step 8');
    // Wrapped names and the current step's drain bar take room too.
    const long = eight.map((s) => ({ ...s, label: `${s.label} with a long name that wraps` }));
    expect(agendaFitHeight({ ...short, agendaItems: long, agendaCurrent: 2 })).toBeGreaterThan(
      fitted,
    );
  });

  it('leaves room for the current step, so a session started later still draws the last', () => {
    const short = agenda({ width: 360, height: 300, agendaItems: eight });
    // Fitted before the session starts, then the last segment becomes current.
    const fitted = agendaFitHeight(short);
    expect(svgOf({ ...short, height: fitted, agendaCurrent: 7 })).toContain('Step 8');
    expect(svgOf({ ...short, height: fitted, agendaCurrent: 0 })).toContain('Step 8');
  });

  it('never shrinks a card, and leaves one with no segments as it is', () => {
    expect(agendaFitHeight(agenda({ width: 330, height: 900 }))).toBe(900);
    expect(agendaFitHeight(agenda({ height: 120, agendaItems: [] }))).toBe(120);
  });

  it('is applied as a tab is built from elements', () => {
    const tab = buildTab(
      't',
      'T',
      [agenda({ height: 300, agendaItems: eight })],
      'preserve',
      undefined,
    );
    expect(tab.elements[0]!.type === 'shape' && tab.elements[0]!.height).toBeGreaterThan(300);
  });
});
