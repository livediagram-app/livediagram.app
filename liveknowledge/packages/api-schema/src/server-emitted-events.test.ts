import { describe, expect, it } from 'vitest';
import { SERVER_EMITTED_EVENT_PAIRS } from './server-emitted-events';
import { TELEMETRY_ACTIONS, TELEMETRY_CATEGORIES } from './telemetry-schema';

// The pairs and their matching are @liveworkspace/api-schema's (and tested there); this checks them
// against this product's closed vocabulary.
describe('server-emitted telemetry pairs (docs/specs/017-telemetry/telemetry.md)', () => {
  it('only names pairs from the closed vocabulary', () => {
    for (const pair of SERVER_EMITTED_EVENT_PAIRS) {
      const [category, action] = pair.split('·');
      expect(TELEMETRY_CATEGORIES).toContain(category);
      expect(TELEMETRY_ACTIONS).toContain(action);
    }
  });
});
