// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('@/hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ push: vi.fn(), replace }),
}));

import { RetiredViewRedirect, RETIRED_VIEW_TARGETS } from './RetiredViewRedirect';
import { PROFILE_TARGET, ProfileRedirect } from './profile/ProfileRedirect';

afterEach(() => {
  replace.mockClear();
  vi.unstubAllGlobals();
});

describe('retired Explorer addresses', () => {
  it.each(Object.entries(RETIRED_VIEW_TARGETS))(
    '/explorer/%s replaces itself with %s',
    async (from, to) => {
      render(<RetiredViewRedirect from={from as keyof typeof RETIRED_VIEW_TARGETS} />);
      await waitFor(() => expect(replace).toHaveBeenCalledWith(to));
    },
  );

  it("/explorer/profile, every notification email's unsubscribe link, opens Settings on Notifications", () => {
    const locationReplace = vi.fn();
    vi.stubGlobal('location', { ...window.location, replace: locationReplace });
    render(<ProfileRedirect />);
    expect(PROFILE_TARGET).toBe('/explorer?settings=notifications');
    expect(locationReplace).toHaveBeenCalledWith(PROFILE_TARGET);
  });
});
