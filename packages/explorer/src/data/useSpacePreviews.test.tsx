import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { IndexClient, SpacePreview } from '@liveworkspace/index-client';
import { useSpacePreviews } from './useSpacePreviews';

// A client whose only call is the previews read, answering what each test gives it.
function clientAnswering(answer: () => Promise<unknown>): IndexClient {
  return { spacePreviews: answer } as unknown as IndexClient;
}

function previews(client: IndexClient) {
  return renderHook(() => useSpacePreviews({ client, app: null, epoch: 0, teamsKey: '' }));
}

describe('useSpacePreviews', () => {
  it('maps each space by its team', async () => {
    const mine: SpacePreview = { teamId: null, itemCount: 0, items: [] };
    const { result } = previews(clientAnswering(async () => ({ spaces: [mine] })));
    await waitFor(() => expect(result.current.byTeam).not.toBeNull());
    expect(result.current.byTeam!.get(null)).toBe(mine);
    expect(result.current.error).toBe(false);
  });

  // A body that is not JSON reads as null in the index client (a local stack whose router answers with a page),
  // and a 204 as undefined: both used to throw "Cannot destructure property spaces of null" as a page error.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an answer without a spaces list', { spaces: 'none' }],
  ])('reads %s as a failed read, never a throw', async (_, answer) => {
    const { result } = previews(clientAnswering(async () => answer));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.byTeam).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('reads a refusal as a failed read', async () => {
    const { result } = previews(clientAnswering(async () => Promise.reject(new Error('503'))));
    await waitFor(() => expect(result.current.error).toBe(true));
  });
});
