// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The editor's Share binds the shared Community tab to livehuddle (docs/specs/025-community/community.md
// "Publishing", "Turning the Community off"): the Community's switch, the canvas's sign-in return, the person as the
// listing's author, and the header badge's store. The tab itself is @liveworkspace/community-ui's, tested there.

const h = vi.hoisted(() => ({ enabled: true, community: null as Record<string, unknown> | null }));

vi.mock('@livehuddle/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@livehuddle/ui')>()),
  useCommunityEnabled: () => h.enabled,
}));
vi.mock('@liveworkspace/explorer', () => ({
  ShareDialogWithCommunity: (p: { community: Record<string, unknown> }) => {
    h.community = p.community;
    return null;
  },
}));
vi.mock('@/lib/community-share-host', () => ({
  livehuddleCommunityHost: (opts: { documentId: string }) => ({ documentId: opts.documentId }),
}));

import { getCommunityState } from '@/lib/community-state-store';
import { ShareDialogWithCommunity } from './ShareDialogWithCommunity';

function renderDialog(over: { signedIn?: boolean; firstTabEmpty?: boolean } = {}) {
  const share = {
    client: {},
    item: {
      id: 'd1',
      app: 'livehuddle',
      kind: 'canvas',
      sharedVia: null,
      title: 'Doc',
      teamId: null,
    },
    shareUrl: () => '',
    onClose: () => {},
  } as unknown as Parameters<typeof ShareDialogWithCommunity>[0];
  render(
    <ShareDialogWithCommunity
      {...share}
      ownerId="user_a"
      documentName="Doc"
      author={{ name: 'Ada', color: '#f97316' }}
      signedIn={over.signedIn ?? true}
      firstTabEmpty={over.firstTabEmpty}
    />,
  );
  return h.community!;
}

beforeEach(() => {
  h.enabled = true;
  h.community = null;
});
afterEach(cleanup);

describe('ShareDialogWithCommunity', () => {
  it('binds the tab to the canvas, its owner and the person', () => {
    const community = renderDialog({ firstTabEmpty: true });
    expect(community).toMatchObject({
      host: { documentId: 'd1' },
      ownerId: 'user_a',
      documentName: 'Doc',
      signedIn: true,
      communityOn: true,
      firstTabEmpty: true,
      author: { name: 'Ada', color: '#f97316' },
    });
    expect(String(community.signInHref)).toContain(encodeURIComponent('/document/d1'));
  });

  it('follows the Community switch and the sign-in', () => {
    h.enabled = false;
    expect(renderDialog({ signedIn: false })).toMatchObject({
      communityOn: false,
      signedIn: false,
    });
  });

  it('keeps the header badge in step with the post', () => {
    const community = renderDialog();
    (community.onStateChange as (s: string | null) => void)('listed');
    expect(getCommunityState('d1')).toBe('listed');
    (community.onStateChange as (s: string | null) => void)(null);
    expect(getCommunityState('d1')).toBeNull();
  });
});
