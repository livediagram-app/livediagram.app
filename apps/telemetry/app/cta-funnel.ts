// The Pages tab's landing funnel (spec/153), kept pure so it is tested apart
// from the view. Three independent counts per public surface, read from rows
// the summary already carries: page views of its pages (`Page·View`, spec/150),
// arrivals at /new from its CTAs (`Cta·Opened`), and diagrams those visits
// created (`Cta·Created`). Nothing links one count to another; the rates are
// just one divided by the next.

import {
  CTA_SOURCES,
  CTA_SURFACES,
  ctaSurfaceOfPath,
  isCtaSource,
  type CtaSlot,
  type CtaSource,
  type CtaSurface,
  type TelemetryCount,
} from '@livediagram/api-schema';

export type FunnelCounts = { views: number; arrived: number; created: number };

export type FunnelSlot = {
  source: CtaSource;
  label: string;
  arrived: number;
  created: number;
};

export type FunnelSurface = FunnelCounts & {
  surface: CtaSurface;
  label: string;
  // Every slot the surface has, including those nobody used: a button with
  // no arrivals is exactly what the funnel is for spotting. Most arrivals
  // first, ties in table order.
  slots: FunnelSlot[];
};

export type LandingFunnel = {
  total: FunnelCounts;
  // Surfaces with any views or arrivals, busiest first.
  surfaces: FunnelSurface[];
  // Surfaces left out for having nothing in the window.
  quiet: CtaSurface[];
};

export const SURFACE_LABELS: Record<CtaSurface, string> = {
  Home: 'Landing Page',
  Feature: 'Feature Pages',
  Compare: 'Comparison Pages',
  Faq: 'FAQ',
  Status: 'Status Page',
  Dashboard: 'Telemetry Dashboard',
  Help: 'Help Centre',
};

// What each slot's button says, so a row reads as the thing on the page.
const SLOT_LABELS: Record<CtaSlot, string> = {
  Header: 'Header: Choose Template',
  HeaderDraw: 'Header: Just Draw',
  Hero: 'Hero: Choose Template',
  HeroDraw: 'Hero: Just Draw',
  Gallery: 'Template Gallery Cards',
  GalleryDraw: 'Gallery: Blank Canvas Link',
  Closing: 'Closing Band: Start Drawing',
  Card: 'Footer Card: Start Drawing',
};

// Where one surface words a slot differently from the rest.
const SOURCE_LABELS: Partial<Record<CtaSource, string>> = {
  'Feature.Hero': 'Hero: Start Drawing',
  'Help.Header': 'Header: Start Drawing',
};

export function ctaSourceLabel(source: CtaSource): string {
  return SOURCE_LABELS[source] ?? SLOT_LABELS[source.slice(source.indexOf('.') + 1) as CtaSlot];
}

const zero = (): FunnelCounts => ({ views: 0, arrived: 0, created: 0 });

/** Build the funnel for one window's rows. */
export function landingFunnel(rows: readonly TelemetryCount[]): LandingFunnel {
  const views = new Map<CtaSurface, number>();
  const arrived = new Map<CtaSource, number>();
  const created = new Map<CtaSource, number>();
  const add = <K>(map: Map<K, number>, key: K, n: number) => map.set(key, (map.get(key) ?? 0) + n);

  for (const r of rows) {
    if (r.category === 'Page' && r.action === 'View' && r.type) {
      const surface = ctaSurfaceOfPath(r.type);
      if (surface) add(views, surface, r.count);
    } else if (r.category === 'Cta' && isCtaSource(r.type)) {
      if (r.action === 'Opened') add(arrived, r.type, r.count);
      else if (r.action === 'Created') add(created, r.type, r.count);
    }
  }

  const total = zero();
  const surfaces: FunnelSurface[] = [];
  const quiet: CtaSurface[] = [];
  CTA_SURFACES.forEach((surface) => {
    const slots = CTA_SOURCES[surface]
      .map((slot, order) => {
        const source = `${surface}.${slot}` as CtaSource;
        return {
          order,
          source,
          label: ctaSourceLabel(source),
          arrived: arrived.get(source) ?? 0,
          created: created.get(source) ?? 0,
        };
      })
      .sort((a, b) => b.arrived - a.arrived || a.order - b.order)
      .map(({ order: _order, ...slot }) => slot);
    const counts: FunnelCounts = {
      views: views.get(surface) ?? 0,
      arrived: slots.reduce((n, s) => n + s.arrived, 0),
      created: slots.reduce((n, s) => n + s.created, 0),
    };
    total.views += counts.views;
    total.arrived += counts.arrived;
    total.created += counts.created;
    if (counts.views === 0 && counts.arrived === 0 && counts.created === 0) quiet.push(surface);
    else surfaces.push({ surface, label: SURFACE_LABELS[surface], ...counts, slots });
  });
  // Stable: surfaces tied on both keep the table order.
  surfaces.sort((a, b) => b.views - a.views || b.arrived - a.arrived);
  return { total, surfaces, quiet };
}

/** `part / whole`, or null when there's nothing to divide by. Never capped. */
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/** A rate as a percentage: one decimal under 10%, whole above, "n/a" for none. */
export function formatRate(value: number | null): string {
  if (value === null) return 'n/a';
  const percent = value * 100;
  if (percent === 0) return '0%';
  if (percent < 10) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent).toLocaleString()}%`;
}

/**
 * The slot to tag as the surface's best: most diagrams created, ties to the
 * higher conversion. Null when fewer than two slots have created anything,
 * since a lone winner isn't a comparison.
 */
export function bestSlot(slots: readonly FunnelSlot[]): CtaSource | null {
  const scoring = slots.filter((s) => s.created > 0);
  if (scoring.length < 2) return null;
  const best = [...scoring].sort(
    (a, b) =>
      b.created - a.created ||
      (rate(b.created, b.arrived) ?? 0) - (rate(a.created, a.arrived) ?? 0),
  )[0]!;
  return best.source;
}
