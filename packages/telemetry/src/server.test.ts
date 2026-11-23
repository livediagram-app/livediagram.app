import { describe, expect, it } from 'vitest';
import { postServerEvents } from './server';
import { captureTelemetry, TELEMETRY_ON } from './testing';

describe('postServerEvents', () => {
  it("posts the batch as the app, with the Worker's key", async () => {
    const events = captureTelemetry();
    await postServerEvents(TELEMETRY_ON, 'livediagram.app', [{ category: 'Account', action: 'Created' }]);
    expect(events).toEqual([{ category: 'Account', action: 'Created' }]);
  });

  it('sends nothing when off, without a key, or with no events', async () => {
    const events = captureTelemetry();
    await postServerEvents({}, 'livediagram.app', [{ category: 'A', action: 'B' }]);
    await postServerEvents({ TELEMETRY_ENABLED: 'true' }, 'livediagram.app', [{ category: 'A', action: 'B' }]);
    await postServerEvents(TELEMETRY_ON, 'livediagram.app', []);
    expect(events).toEqual([]);
  });
});
