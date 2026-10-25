'use client';

import { createContext, useContext, type ComponentType } from 'react';
import type {
  TelemetryApp,
  TelemetryCount,
  TelemetrySummary,
  TelemetryWindowKey,
} from '@liveworkspace/telemetry';
import type { CtaFunnel } from './cta-funnel';
import type { NonThemePick } from './look-feel-types';
import type { MetricGroup } from './metric-series';
import type { TypeAliases } from './rank';
import type { TimingChart } from './timing-stats';

// One app's dashboard, as data (liveworkspace/docs/telemetry.md "The dashboard"). Every app's
// dashboard is the same set of views in _shared; what differs between livediagram, liveplanner,
// livedocuments and livedesign is this: its events and how they read, its charts, and its name.
// Each app's folder exports one (`<app>/config.ts`) and the page hands it to AppDashboard.

/** What an app calls the thing people make, in each form the copy needs. */
export type Noun = {
  /** 'document' */
  one: string;
  /** 'documents' */
  many: string;
  /** 'Document': also the telemetry category its events are sent under. */
  Title: string;
};

export const noun = (one: string): Noun => ({
  one,
  many: `${one}s`,
  Title: one.charAt(0).toUpperCase() + one.slice(1),
});

export type ViewProps = { summary: TelemetrySummary; active: TelemetryWindowKey };

/** A Detail tab's section that only some apps have: the groups it shows and how it introduces them. */
export type GroupsSection = { intro: string; groups: MetricGroup[] };

export type TelemetryAppConfig = {
  id: TelemetryApp;
  /** 'livediagram', as the copy and the CLI name it. */
  name: string;
  /** The app's brand-500, for the few hues drawn outside CSS (the word cloud's glow). */
  accent: string;
  noun: Noun;
  /** Every category the app sends, with its chart colour (light; dark is derived). */
  categoryColors: Readonly<Record<string, string>>;
  /** The plain-language sentence under a metric (event-explanation.ts). */
  explain: (category: string, action: string, type: string | null) => string;
  /** Events of features the app has removed: they never render (retired-events.ts). */
  isRetired: (category: string, action: string, type: string | null) => boolean;
  funnel: CtaFunnel;
  pageViews: { apps: readonly string[]; appOf: (path: string) => string | null };
  /** A tab only this app has (livediagram's Community), loaded on its own like the others. */
  community?: {
    /** Fetches its code (the idle prefetch calls it). */
    load: () => Promise<ComponentType<ViewProps>>;
    /** The view itself, loading on its own (`dynamic(load)`, made once in the config). */
    View: ComponentType<ViewProps>;
    /** Its charts, for the coverage checks. */
    groups: MetricGroup[];
  };
  dashboard: MetricGroup[];
  editing: {
    groups: MetricGroup[];
    /** The Export Formats card's subtitle: which formats the app exports. */
    exportFormats: string;
    /** Whether the app has an AI opt-in setting the intro points to. */
    aiOptIn: boolean;
  };
  palette: {
    /** The palette's tabs (the app's PALETTE_TELEMETRY_TYPES). Collaborate shows only where present. */
    tabs: Readonly<Record<string, readonly string[]>>;
    aliases: TypeAliases;
    subtitles: { shapes: string; collaborate?: string; devices: string };
  };
  /** The canvas selection modes and their options; an app without any has no Modes section. */
  modes?: {
    /** The canvas selection modes the app has (`Canvas·Used·<mode>`). */
    selection: readonly string[];
    selectionSubtitle: string;
    /** `UI·Changed` types that are an option inside a mode. */
    option: RegExp;
    optionsSubtitle: string;
  };
  settings: MetricGroup[];
  /** Theme·Changed types the Themes ranking leaves out (its palette-types' isNonThemePick). */
  isNonThemePick: NonThemePick;
  /** The Features tab's people section: Facilitation, or Discussion & Teams. */
  teamwork: GroupsSection & { key: 'facilitation' | 'teamwork'; title: string };
  connections: GroupsSection;
  pages: MetricGroup[];
  help: {
    groups: MetricGroup[];
    /** The welcome tour's steps, in order, for an app whose tour reports them. */
    tourSteps?: {
      rows: (rows: TelemetryCount[]) => TelemetryCount[];
      label: (type: string) => string;
    };
  };
  tours: MetricGroup[];
  exceptions: {
    groups: MetricGroup[];
    recovery: MetricGroup[];
    /** "such as …": a degradation this app carries people through. */
    warningExample: string;
  };
  timings: { editor: readonly TimingChart[]; vitals: readonly TimingChart[] };
};

/** Every chart group an app's tabs show, for the coverage checks. */
export function allGroups(app: TelemetryAppConfig): MetricGroup[] {
  return [
    ...app.dashboard,
    ...app.editing.groups,
    ...app.settings,
    ...app.exceptions.groups,
    ...app.exceptions.recovery,
    ...app.pages,
    ...app.help.groups,
    ...app.tours,
    ...app.teamwork.groups,
    ...app.connections.groups,
    ...(app.community?.groups ?? []),
    { title: 'Timings', metrics: [...app.timings.editor, ...app.timings.vitals] },
  ];
}

const AppContext = createContext<TelemetryAppConfig | null>(null);

export const TelemetryAppProvider = AppContext.Provider;

/** The app whose dashboard this is. Every view sits under AppDashboard's provider. */
export function useTelemetryApp(): TelemetryAppConfig {
  const app = useContext(AppContext);
  if (!app) throw new Error('useTelemetryApp: no TelemetryAppProvider above this view');
  return app;
}
