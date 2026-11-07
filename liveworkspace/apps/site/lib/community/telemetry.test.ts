import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppName } from '@liveworkspace/sites';

// The Community page's telemetry (liveworkspace/docs/specs/007-community/community.md "One page for every app",
// Telemetry): in the name of the app whose address the page is on, with that app's opt-out; nothing on
// liveworkspace.app.

const h = vi.hoisted(() => ({
  host: null as AppName | null,
  made: [] as { app: string; storageKey: string; url: string }[],
  sent: [] as [string, string, string | undefined][],
}));

vi.mock('@/lib/explorer/page-app', () => ({
  pageApp: () => h.host,
  workspaceOrigin: () => 'https://www.liveworkspace.app',
}));
vi.mock('@liveworkspace/telemetry-client', () => ({
  createLazyTrack: (opts: { app: string; storageKey: string; url: string }) => {
    h.made.push(opts);
    return (category: string, action: string, type?: string) =>
      h.sent.push([category, action, type]);
  },
}));

import { communityTelemetry, resetCommunityTelemetry } from './telemetry';

beforeEach(() => {
  h.host = null;
  h.made.length = 0;
  h.sent.length = 0;
  resetCommunityTelemetry();
});

describe("the Community page's telemetry", () => {
  it("sends each event in the app's name, to liveworkspace.app's service, with the app's opt-out", () => {
    h.host = 'livedesign';
    communityTelemetry.openedPost();
    communityTelemetry.reported('personal-info');
    communityTelemetry.selected('Mine');
    communityTelemetry.openedHelp('finding');
    expect(h.made).toEqual([
      {
        url: 'https://www.liveworkspace.app/api/telemetry',
        app: 'livedesign.app',
        enabled: expect.any(Boolean),
        storageKey: 'livedesign:user-preferences:v1',
      },
    ]);
    expect(h.sent).toEqual([
      ['Community', 'Opened', 'Post'],
      ['Community', 'Reported', 'PersonalInfo'],
      ['Community', 'Selected', 'Mine'],
      ['UI', 'Opened', 'finding-community-documents'],
    ]);
  });

  it('sends nothing on liveworkspace.app, where no app is the sender', () => {
    communityTelemetry.likedPost();
    communityTelemetry.searched();
    expect(h.made).toEqual([]);
    expect(h.sent).toEqual([]);
  });
});
