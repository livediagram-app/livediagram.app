// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSubscription } from '@liveworkspace/subscription-ui/provider';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import { DEFERRED_AUTH_DEFAULT, type DeferredAuthState } from './deferred-auth';
import { accountKnown, SubscriptionMount } from './subscription-mount';

function Status() {
  return <span>{useSubscription().status}</span>;
}

const SIGNED_IN: DeferredAuthState = {
  ...DEFERRED_AUTH_DEFAULT,
  authLoaded: true,
  isSignedIn: true,
  userId: 'user_a',
};

afterEach(() => {
  cleanup();
  setProForTests(null);
});

describe('accountKnown', () => {
  it('asks nothing until the session answers, and nothing for a guest', () => {
    expect(accountKnown(DEFERRED_AUTH_DEFAULT)).toBe('checking');
    expect(accountKnown({ authLoaded: true, isSignedIn: false })).toBe('out');
    expect(accountKnown(SIGNED_IN)).toBe('in');
  });
});

describe('SubscriptionMount', () => {
  it('draws its children alone with Pro off: every hook answers off', () => {
    setProForTests(false);
    render(
      <SubscriptionMount auth={SIGNED_IN}>
        <Status />
      </SubscriptionMount>,
    );
    expect(screen.getByText('off')).toBeTruthy();
  });

  it('shares a subscription context with Pro on, signed out for a guest', () => {
    setProForTests(true);
    render(
      <SubscriptionMount auth={{ ...DEFERRED_AUTH_DEFAULT, authLoaded: true }}>
        <Status />
      </SubscriptionMount>,
    );
    expect(screen.getByText('signed_out')).toBeTruthy();
  });
});
