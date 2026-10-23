// Each app's closed event vocabulary, as that app defines it (its own api-schema): the service stores
// only events its app could have sent. The vocabularies stay with their apps because the editors that
// emit them and the vocabulary have to change together; the service only reads them.

import {
  isServerEmittedEvent as isLivedesignServerEvent,
  isValidTelemetryEvent as isLivedesignEvent,
} from '@livedesign/api-schema';
import {
  isServerEmittedEvent as isLivediagramServerEvent,
  isValidTelemetryEvent as isLivediagramEvent,
} from '@livediagram/api-schema';
import {
  isServerEmittedEvent as isLivedocumentsServerEvent,
  isValidTelemetryEvent as isLivedocumentsEvent,
} from '@livedocuments/api-schema';
import {
  isServerEmittedEvent as isLiveplannerServerEvent,
  isValidTelemetryEvent as isLiveplannerEvent,
} from '@liveplanner/api-schema';
import { catalogueEvents, type AppCatalogue } from '@liveworkspace/settings/catalogue';
import { CATALOGUE as LIVEDESIGN_SETTINGS } from '@liveworkspace/settings/catalogues/livedesign';
import { CATALOGUE as LIVEDIAGRAM_SETTINGS } from '@liveworkspace/settings/catalogues/livediagram';
import { CATALOGUE as LIVEDOCUMENTS_SETTINGS } from '@liveworkspace/settings/catalogues/livedocuments';
import { CATALOGUE as LIVEPLANNER_SETTINGS } from '@liveworkspace/settings/catalogues/liveplanner';
import {
  isExplorerTelemetryEvent,
  TELEMETRY_TYPE_PATTERN,
  type TelemetrySender,
  type TelemetryWireEvent,
} from '@liveworkspace/telemetry';

type Vocabulary = {
  isValid: (value: unknown) => value is TelemetryWireEvent;
  // Events only the app's own Workers may report (a sign-up, an email sent): a browser batch that
  // carries one is a stale bundle, and counting it would count it twice.
  isServerOnly: (event: TelemetryWireEvent) => boolean;
};

// liveworkspace.app's own: the Explorer's events, sent while it is filtered to All Apps.
function isPlatformEvent(value: unknown): value is TelemetryWireEvent {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  if (typeof e.category !== 'string' || typeof e.action !== 'string') return false;
  if (e.type !== undefined && e.type !== null) {
    if (typeof e.type !== 'string' || !TELEMETRY_TYPE_PATTERN.test(e.type)) return false;
  }
  return isExplorerTelemetryEvent(e as TelemetryWireEvent);
}

export const VOCABULARIES: Record<TelemetrySender, Vocabulary> = {
  'liveworkspace.app': { isValid: isPlatformEvent, isServerOnly: () => false },
  'livediagram.app': {
    isValid: isLivediagramEvent as Vocabulary['isValid'],
    isServerOnly: isLivediagramServerEvent,
  },
  'liveplanner.app': {
    isValid: isLiveplannerEvent as Vocabulary['isValid'],
    isServerOnly: isLiveplannerServerEvent,
  },
  'livedocuments.app': {
    isValid: isLivedocumentsEvent as Vocabulary['isValid'],
    isServerOnly: isLivedocumentsServerEvent,
  },
  'livedesign.app': {
    isValid: isLivedesignEvent as Vocabulary['isValid'],
    isServerOnly: isLivedesignServerEvent,
  },
};

// What liveworkspace.app may report in an app's name besides the Explorer's events: a setting of the app's changed
// on the settings page or in its dialog there, as the app's own Settings reports it (@liveworkspace/settings
// catalogueEvents over the app's catalogue). Each app's set is built once per isolate.
const keyOf = (e: { category: string; action: string; type?: string | null }) =>
  `${e.category}·${e.action}·${e.type ?? ''}`;
const settingsSet = (catalogue: AppCatalogue) => new Set(catalogueEvents(catalogue).map(keyOf));
const SITE_SETTINGS: Partial<Record<TelemetrySender, Set<string>>> = {
  'livediagram.app': settingsSet(LIVEDIAGRAM_SETTINGS),
  'liveplanner.app': settingsSet(LIVEPLANNER_SETTINGS),
  'livedocuments.app': settingsSet(LIVEDOCUMENTS_SETTINGS),
  'livedesign.app': settingsSet(LIVEDESIGN_SETTINGS),
};

export function isSiteSettingsEvent(app: TelemetrySender, event: TelemetryWireEvent): boolean {
  return SITE_SETTINGS[app]?.has(keyOf(event)) ?? false;
}
