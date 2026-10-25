import { describe, expect, it } from 'vitest';
import { isTelemetryApp, isTelemetryAppFilter, telemetryAppOfOrigin } from './apps';

describe('telemetry apps', () => {
  it('knows each app by its site', () => {
    expect(isTelemetryApp('livediagram.app')).toBe(true);
    expect(isTelemetryApp('liveplanner.app')).toBe(true);
    expect(isTelemetryApp('all')).toBe(false);
    expect(isTelemetryApp('livediagram.app/')).toBe(false);
    expect(isTelemetryAppFilter('all')).toBe(true);
  });

  it('maps an origin to the app that serves it, and nothing else', () => {
    expect(telemetryAppOfOrigin('https://livediagram.app')).toBe('livediagram.app');
    expect(telemetryAppOfOrigin('https://staging.liveplanner.app')).toBe('liveplanner.app');
    expect(telemetryAppOfOrigin('https://evil.example')).toBeNull();
    expect(telemetryAppOfOrigin('http://livediagram.app')).toBeNull();
  });
});

describe('liveworkspace.app as a sender', () => {
  it('may name itself or an app, and its origins are its own', async () => {
    const { isTelemetrySender, isPlatformOrigin, TELEMETRY_SENDERS } = await import('./apps');
    expect(isTelemetrySender('liveworkspace.app')).toBe(true);
    expect(isTelemetrySender('liveplanner.app')).toBe(true);
    expect(isTelemetrySender('all')).toBe(false);
    expect(isTelemetryApp('liveworkspace.app')).toBe(false);
    expect(TELEMETRY_SENDERS).toContain('liveworkspace.app');
    expect(isPlatformOrigin('https://liveworkspace-gateway.liveworkspace-easing509.workers.dev')).toBe(true);
    expect(isPlatformOrigin('https://livediagram.app')).toBe(false);
    expect(telemetryAppOfOrigin('https://liveworkspace-gateway.liveworkspace-easing509.workers.dev')).toBeNull();
  });
});
