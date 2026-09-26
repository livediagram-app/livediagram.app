import { describe, expect, it } from 'vitest';
import { ALL_CTA_SOURCES, type TelemetryCount } from '@livediagram/api-schema';
import { bestSlot, ctaSourceLabel, formatRate, landingFunnel, rate } from './cta-funnel';

const row = (category: string, action: string, type: string | null, count: number) =>
  ({ category, action, type, count }) satisfies TelemetryCount;

const ROWS: TelemetryCount[] = [
  row('Page', 'View', '/', 200),
  row('Page', 'View', '/features/present', 30),
  row('Page', 'View', '/features/customise', 20),
  row('Page', 'View', '/alternatives', 5),
  row('Page', 'View', '/alternatives/miro', 15),
  row('Page', 'View', '/diagram', 900),
  row('Page', 'View', '/new', 80),
  row('Cta', 'Opened', 'Home.Hero', 40),
  row('Cta', 'Created', 'Home.Hero', 30),
  row('Cta', 'Opened', 'Home.Gallery', 25),
  row('Cta', 'Created', 'Home.Gallery', 24),
  row('Cta', 'Opened', 'Feature.Closing', 4),
  row('Cta', 'Created', 'Feature.Closing', 1),
  // Rows the funnel must not read.
  row('Cta', 'Opened', 'Home.Nope', 99),
  row('Diagram', 'Created', 'Cloud', 500),
];

describe('landingFunnel', () => {
  const funnel = landingFunnel(ROWS);

  it('sums each surface’s page views, arrivals and creations', () => {
    const home = funnel.surfaces.find((s) => s.surface === 'Home')!;
    expect(home).toMatchObject({ views: 200, arrived: 65, created: 54, label: 'Landing Page' });
    const feature = funnel.surfaces.find((s) => s.surface === 'Feature')!;
    expect(feature).toMatchObject({ views: 50, arrived: 4, created: 1 });
    const compare = funnel.surfaces.find((s) => s.surface === 'Compare')!;
    expect(compare).toMatchObject({ views: 20, arrived: 0, created: 0 });
  });

  it('totals only the public surfaces, never the editor', () => {
    expect(funnel.total).toEqual({ views: 270, arrived: 69, created: 55 });
  });

  it('orders surfaces busiest first and lists the quiet ones apart', () => {
    expect(funnel.surfaces.map((s) => s.surface)).toEqual(['Home', 'Feature', 'Compare']);
    expect(funnel.quiet).toEqual(['Faq', 'Status', 'Dashboard', 'Help']);
  });

  it('keeps every slot, most arrivals first, unused ones in table order', () => {
    const home = funnel.surfaces.find((s) => s.surface === 'Home')!;
    expect(home.slots.map((s) => s.source)).toEqual([
      'Home.Hero',
      'Home.Gallery',
      'Home.Header',
      'Home.HeaderDraw',
      'Home.HeroDraw',
      'Home.GalleryDraw',
      'Home.Closing',
    ]);
    expect(home.slots[0]).toMatchObject({ arrived: 40, created: 30 });
  });

  it('is empty, with every surface quiet, for a window with no rows', () => {
    const empty = landingFunnel([]);
    expect(empty.surfaces).toEqual([]);
    expect(empty.total).toEqual({ views: 0, arrived: 0, created: 0 });
    expect(empty.quiet).toHaveLength(7);
  });
});

describe('rates', () => {
  it('divides, and says so when there is nothing to divide by', () => {
    expect(rate(1, 4)).toBe(0.25);
    expect(rate(3, 0)).toBeNull();
    expect(rate(5, 4)).toBe(1.25);
  });

  it('formats one decimal under 10% and whole percentages above', () => {
    expect(formatRate(null)).toBe('n/a');
    expect(formatRate(0)).toBe('0%');
    expect(formatRate(0.0345)).toBe('3.5%');
    expect(formatRate(0.25)).toBe('25%');
    expect(formatRate(1.25)).toBe('125%');
  });
});

describe('bestSlot', () => {
  const slot = (source: string, arrived: number, created: number) =>
    ({ source, label: source, arrived, created }) as Parameters<typeof bestSlot>[0][number];

  it('picks the most diagrams, breaking a tie on conversion', () => {
    expect(bestSlot([slot('Home.Hero', 40, 10), slot('Home.Gallery', 12, 10)])).toBe(
      'Home.Gallery',
    );
    expect(bestSlot([slot('Home.Hero', 40, 30), slot('Home.Gallery', 25, 24)])).toBe('Home.Hero');
  });

  it('tags nothing without at least two slots to compare', () => {
    expect(bestSlot([slot('Home.Hero', 40, 30), slot('Home.Gallery', 5, 0)])).toBeNull();
    expect(bestSlot([])).toBeNull();
  });
});

describe('ctaSourceLabel', () => {
  it('labels every source in the table', () => {
    for (const source of ALL_CTA_SOURCES) expect(ctaSourceLabel(source)).toBeTruthy();
  });

  it('uses the button’s own wording where a surface differs', () => {
    expect(ctaSourceLabel('Home.Hero')).toBe('Hero: Choose Template');
    expect(ctaSourceLabel('Feature.Hero')).toBe('Hero: Start Drawing');
    expect(ctaSourceLabel('Help.Header')).toBe('Header: Start Drawing');
  });
});
