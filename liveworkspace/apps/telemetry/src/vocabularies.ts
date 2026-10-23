// Each app's closed event vocabulary, as that app defines it (its own api-schema): the service stores
// only events its app could have sent. The vocabularies stay with their apps because the editors that
// emit them and the vocabulary have to change together; the service only reads them.

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
import type { TelemetryApp, TelemetryWireEvent } from '@liveworkspace/telemetry';

type Vocabulary = {
  isValid: (value: unknown) => value is TelemetryWireEvent;
  // Events only the app's own Workers may report (a sign-up, an email sent): a browser batch that
  // carries one is a stale bundle, and counting it would count it twice.
  isServerOnly: (event: TelemetryWireEvent) => boolean;
};

const NOTHING_YET: Vocabulary = {
  isValid: (_value: unknown): _value is TelemetryWireEvent => false,
  isServerOnly: () => false,
};

export const VOCABULARIES: Record<TelemetryApp, Vocabulary> = {
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
  // livedesign doesn't send to this service yet, so the service stores nothing from it.
  'livedesign.app': NOTHING_YET,
};
