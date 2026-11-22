// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommunityShareTab } from '@liveworkspace/community-ui/share';
import type { ShareDialogProps } from './ShareDialog';

// The tab the Community hook answers, and the props the Share dialog was drawn with.
const state = vi.hoisted(() => ({
  tab: { kind: 'none' } as CommunityShareTab,
  drawn: null as Partial<ShareDialogProps> | null,
}));
vi.mock('@liveworkspace/community-ui/share', () => ({ useCommunityShareTab: () => state.tab }));
vi.mock('./ShareDialog', () => ({
  ShareDialog: (props: Partial<ShareDialogProps>) => {
    state.drawn = props;
    return null;
  },
}));

const { ShareDialogWithCommunity } = await import('./ShareDialogWithCommunity');

const shareTab = (initialView: 'passes' | 'app'): CommunityShareTab => ({
  kind: 'share',
  props: {
    onPasswordSetChange: () => {},
    passwordLockedReason: null,
    onSignInChange: () => {},
    signInLockedReason: null,
    publicNote: null,
    initialView,
    appTab: { label: 'Community', panel: null },
  },
});

function draw(initialView?: 'passes' | 'app') {
  const props = {
    item: { id: 'd1', teamId: null },
    initialView,
    community: { host: {} },
  } as unknown as Parameters<typeof ShareDialogWithCommunity>[0];
  render(<ShareDialogWithCommunity {...props} />);
  return state.drawn;
}

describe('ShareDialogWithCommunity', () => {
  afterEach(() => {
    cleanup();
    state.drawn = null;
  });

  it('opens on Passes by default', () => {
    state.tab = shareTab('passes');
    expect(draw()?.initialView).toBe('passes');
  });

  it("opens on the Community tab when the host asks (the Share legend's Everyone stop)", () => {
    state.tab = shareTab('passes');
    expect(draw('app')?.initialView).toBe('app');
  });

  it('comes back from publishing on the Community tab whatever the host asked', () => {
    state.tab = shareTab('app');
    expect(draw('passes')?.initialView).toBe('app');
  });

  it('is the plain Share dialog without a Community, on the start asked', () => {
    state.tab = { kind: 'none' };
    const drawn = draw('app');
    expect(drawn?.initialView).toBe('app');
    expect(drawn?.appTab).toBeUndefined();
  });
});
