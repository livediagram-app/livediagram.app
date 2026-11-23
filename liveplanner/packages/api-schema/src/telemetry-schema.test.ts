import { describeTelemetrySchema } from '@liveworkspace/api-schema/testing/telemetry-schema-suite';
import {
  isValidTelemetryEvent,
  TELEMETRY_ACTIONS,
  TELEMETRY_CATEGORIES,
  TELEMETRY_TYPE_PATTERN,
} from './telemetry-schema';

// The telemetry ingest validator (docs/specs/017-telemetry/telemetry.md), over this product's closed vocabulary:
// the suite every product's api-schema runs.
describeTelemetrySchema({
  isValidTelemetryEvent,
  TELEMETRY_ACTIONS,
  TELEMETRY_CATEGORIES,
  TELEMETRY_TYPE_PATTERN,
  itemCategory: 'Project',
});
