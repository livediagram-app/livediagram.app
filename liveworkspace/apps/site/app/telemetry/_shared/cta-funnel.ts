// The Pages tab's landing funnel (docs/specs/019-marketing/landing-funnel.md), kept pure so it is tested apart
// from the view. Three independent counts per public surface, read from rows
// the summary already carries: page views of its pages (`Page·View`, docs/specs/017-telemetry/page-view-telemetry.md),
// arrivals at /new from its CTAs (`Cta·Opened`), and what those visits
// created (`Cta·Created`). Nothing links one count to another; the rates are
// just one divided by the next.
//
// Every app has the same funnel over its own surfaces and slots (its api-schema's cta-sources.ts),
// so the app hands those in (createCtaFunnel) and the labels are shared.

import type { TelemetryCount } from '@liveworkspace/telemetry';

export type FunnelCounts = { views: number; arrived: number; created: number };

export type FunnelSlot = {
  source: string;
  label: string;
  arrived: number;
  created: number;
};

export type FunnelSurface = FunnelCounts & {
  surface: string;
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
  quiet: string[];
};

// Every app's public surfaces, by name. An app lists only the surfaces it has.
const SURFACE_LABELS: Readonly<Record<string, string>> = {
  Home: 'Landing Page',
  Feature: 'Feature Pages',
  Compare: 'Comparison Pages',
  Faq: 'FAQ',
  Ai: 'Build with AI',
  Status: 'Status Page',
  Dashboard: 'Telemetry Dashboard',
  Help: 'Help Centre',
  Community: 'Community',
};

// What each slot's button says, so a row reads as the thing on the page. An app words a slot its
// own way with `slotLabels` (livediagram's session is a Workshop).
const SLOT_LABELS: Readonly<Record<string, string>> = {
  Header: 'Header: Choose Template',
  HeaderBlank: 'Header: Start Blank',
  HeaderDraw: 'Header: Blank Diagram',
  HeaderWhiteboard: 'Header: Blank Whiteboard',
  HeaderIllustration: 'Header: Blank Illustration',
  HeaderPlan: 'Header: Blank Plan',
  HeaderSession: 'Header: Blank Session',
  Hero: 'Hero: Diagram',
  HeroDraw: 'Hero: Drawing',
  HeroBrainstorm: 'Hero: Brainstorm',
  HeroBuild: 'Hero: Build Yours',
  HeroCanvas: 'Hero: Canvas',
  HeroSearch: 'Hero: Template Search',
  HeroBlank: 'Hero: Start Blank',
  HeroBlankDraw: 'Hero: Blank Diagram',
  HeroBlankWhiteboard: 'Hero: Blank Whiteboard',
  HeroBlankSession: 'Hero: Blank Session',
  HeroBlankIllustration: 'Hero: Blank Illustration',
  HeroBlankPlan: 'Hero: Blank Plan',
  HeroFan: 'Hero: Template Fan',
  Gallery: 'Template Gallery Cards',
  Templates: 'Category Template Cards',
  GalleryDraw: 'Gallery: Blank Canvas Link',
  Closing: 'Closing Band: Start Drawing',
  Card: 'Footer Card: Start Drawing',
};

// Where one surface words a slot differently from the rest.
const SOURCE_LABELS: Readonly<Record<string, string>> = {
  'Feature.Hero': 'Hero: Start Drawing',
  // Help's header carried a lone Start Drawing until October 2026, then the shared Choose Template pair.
  'Help.Header': 'Header: Choose Template (was Start Drawing)',
};

/** An app's call-to-action vocabulary: its api-schema's cta-sources.ts, handed in as is. */
export type CtaVocabulary = {
  surfaces: readonly string[];
  sources: Readonly<Record<string, readonly string[]>>;
  isSource: (value: unknown) => boolean;
  surfaceOf: (source: never) => string;
  surfaceOfPath: (path: string) => string | null;
  /** Slots this app words its own way. */
  slotLabels?: Readonly<Record<string, string>>;
};

export type CtaFunnel = {
  surfaceLabel: (surface: string) => string;
  sourceLabel: (source: string) => string;
  /** The surface a source sits on, or null when the type is not one of this app's sources. */
  surfaceOfSource: (type: string | null) => string | null;
  /** Build the funnel for one window's rows. */
  landingFunnel: (rows: readonly TelemetryCount[]) => LandingFunnel;
};

const zero = (): FunnelCounts => ({ views: 0, arrived: 0, created: 0 });

export function createCtaFunnel(vocab: CtaVocabulary): CtaFunnel {
  const surfaceLabel = (surface: string) => SURFACE_LABELS[surface] ?? surface;
  const sourceLabel = (source: string) => {
    const slot = source.slice(source.indexOf('.') + 1);
    return SOURCE_LABELS[source] ?? vocab.slotLabels?.[slot] ?? SLOT_LABELS[slot] ?? slot;
  };
  const isSource = (type: string | null): type is string => vocab.isSource(type);
  const surfaceOfSource = (type: string | null) =>
    isSource(type) ? vocab.surfaceOf(type as never) : null;

  function landingFunnel(rows: readonly TelemetryCount[]): LandingFunnel {
    const views = new Map<string, number>();
    const arrived = new Map<string, number>();
    const created = new Map<string, number>();
    const add = (map: Map<string, number>, key: string, n: number) =>
      map.set(key, (map.get(key) ?? 0) + n);

    for (const r of rows) {
      if (r.category === 'Page' && r.action === 'View' && r.type) {
        const surface = vocab.surfaceOfPath(r.type);
        if (surface) add(views, surface, r.count);
      } else if (r.category === 'Cta' && isSource(r.type)) {
        if (r.action === 'Opened') add(arrived, r.type, r.count);
        else if (r.action === 'Created') add(created, r.type, r.count);
      }
    }

    const total = zero();
    const surfaces: FunnelSurface[] = [];
    const quiet: string[] = [];
    vocab.surfaces.forEach((surface) => {
      const slots = (vocab.sources[surface] ?? [])
        .map((slot, order) => {
          const source = `${surface}.${slot}`;
          return {
            order,
            source,
            label: sourceLabel(source),
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
      else surfaces.push({ surface, label: surfaceLabel(surface), ...counts, slots });
    });
    // Stable: surfaces tied on both keep the table order.
    surfaces.sort((a, b) => b.views - a.views || b.arrived - a.arrived);
    return { total, surfaces, quiet };
  }

  return { surfaceLabel, sourceLabel, surfaceOfSource, landingFunnel };
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
 * The slot to tag as the surface's best: most created, ties to the
 * higher conversion. Null when fewer than two slots have created anything,
 * since a lone winner isn't a comparison.
 */
export function bestSlot(slots: readonly FunnelSlot[]): string | null {
  const scoring = slots.filter((s) => s.created > 0);
  if (scoring.length < 2) return null;
  const best = [...scoring].sort(
    (a, b) =>
      b.created - a.created ||
      (rate(b.created, b.arrived) ?? 0) - (rate(a.created, a.arrived) ?? 0),
  )[0]!;
  return best.source;
}
