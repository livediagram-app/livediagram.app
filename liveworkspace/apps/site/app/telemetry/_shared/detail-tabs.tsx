import type { ReactNode } from 'react';
import type { TelemetryAppConfig } from './app';
import {
  AlertGlyph,
  BrushGlyph,
  DiscussionGlyph,
  FolderGlyph,
  HeartGlyph,
  HelpGlyph,
  LinkGlyph,
  PaletteGlyph,
  PencilGlyph,
  PeopleGlyph,
  PointerGlyph,
  SettingsGlyph,
  TimerGlyph,
  ToursGlyph,
  VitalsGlyph,
  WindowGlyph,
} from './glyphs';
import { DETAIL_KEYS, type DetailKey } from './view-keys';

// The Detail tabs (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard", The tabs): one area a tab,
// so each is found by name in the row. Until November 2026 four tabs gathered them as sections (Features, Pages &
// Help, Community, Health), and an area was a scroll down a long page from its tab.
export type DetailTab = { key: DetailKey; label: string; icon: ReactNode };

const TABS: Record<DetailKey, { label: string; icon: ReactNode }> = {
  editing: { label: 'Editing', icon: <PencilGlyph /> },
  palette: { label: 'Palette', icon: <PaletteGlyph /> },
  modes: { label: 'Modes', icon: <PointerGlyph /> },
  lookfeel: { label: 'Look & Feel', icon: <BrushGlyph /> },
  settings: { label: 'Settings', icon: <SettingsGlyph /> },
  // The two people tabs take their name from the app (its config's `teamwork.title`).
  facilitation: { label: 'Facilitation', icon: <PeopleGlyph /> },
  teamwork: { label: 'Discussion & Teams', icon: <DiscussionGlyph /> },
  explorer: { label: 'Explorer', icon: <FolderGlyph /> },
  community: { label: 'Community', icon: <HeartGlyph /> },
  connections: { label: 'Connections', icon: <LinkGlyph /> },
  pages: { label: 'Pages', icon: <WindowGlyph /> },
  help: { label: 'Help', icon: <HelpGlyph /> },
  tours: { label: 'Tours & Prompts', icon: <ToursGlyph /> },
  exceptions: { label: 'Exceptions', icon: <AlertGlyph /> },
  timings: { label: 'Timings', icon: <TimerGlyph /> },
  vitals: { label: 'Web Vitals', icon: <VitalsGlyph /> },
};

/** Whether the app has anything for a tab: a tab it has nothing for is left out, never shown empty. */
export function hasDetailTab(app: TelemetryAppConfig, key: DetailKey): boolean {
  if (key === 'facilitation' || key === 'teamwork') return app.teamwork.key === key;
  if (key === 'modes') return app.modes !== undefined;
  if (key === 'explorer') return app.explorer !== undefined;
  return true;
}

/** The app's Detail tabs, in the row's order. */
export function detailTabs(app: TelemetryAppConfig): DetailTab[] {
  return DETAIL_KEYS.filter((key) => hasDetailTab(app, key)).map((key) => ({
    key,
    ...TABS[key],
    ...(key === app.teamwork.key ? { label: app.teamwork.title } : {}),
  }));
}
