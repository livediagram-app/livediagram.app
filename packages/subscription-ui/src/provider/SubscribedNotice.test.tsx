// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SUBSCRIBED_NOTICE_MS, SubscribedNotice } from './SubscribedNotice';

// subscription.md "Back from the checkout": said once, for a few seconds.

afterEach(() => vi.useRealTimers());

describe('SubscribedNotice', () => {
  it('leaves a short while after it appeared, whatever function it is handed on later renders', () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(
      <SubscribedNotice tier="pro" teamName={null} pricingHref="/pricing" onDismiss={first} />,
    );
    expect(screen.getByRole('status').textContent).toContain('You’re on Pro');
    // A new function on every render: the timer keeps the time it started with, and calls the newest.
    for (let at = 1000; at < SUBSCRIBED_NOTICE_MS; at += 1000) {
      act(() => void vi.advanceTimersByTime(1000));
      rerender(
        <SubscribedNotice
          tier="pro"
          teamName={null}
          pricingHref="/pricing"
          onDismiss={() => latest()}
        />,
      );
    }
    expect(latest).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1000));
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('names the team for a team’s subscription, and stops its timer when it goes', () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    const { unmount } = render(
      <SubscribedNotice
        tier="team"
        teamName="Garden Club"
        pricingHref="/pricing"
        onDismiss={dismiss}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Garden Club Is on Pro for Teams');
    unmount();
    act(() => void vi.advanceTimersByTime(SUBSCRIBED_NOTICE_MS));
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('says what the tier changed, from the contract’s own figures, with the way to every limit', () => {
    render(
      <SubscribedNotice tier="pro" teamName={null} pricingHref="/pricing" onDismiss={vi.fn()} />,
    );
    const said = screen.getByRole('status').textContent;
    expect(said).toContain('Your new limits are live in every app.');
    expect(said).toContain(
      '10,000 automation runs a month across all your items, up from 500. A message to Slack, Teams or a webhook is one run.',
    );
    expect(said).toContain('500 automation rules, up from 25.');
    expect(said).not.toContain('webhook deliveries');
    expect(said).toContain(
      '1,000 AI credits a month, 50 GB of images, and every version and snapshot kept.',
    );
    expect(screen.getByRole('link', { name: 'See Limits' }).getAttribute('href')).toBe('/pricing');
  });

  it('gives a team its own figures, a member', () => {
    render(
      <SubscribedNotice tier="team" teamName="Garden Club" pricingHref="/p" onDismiss={vi.fn()} />,
    );
    const said = screen.getByRole('status').textContent;
    expect(said).toContain('The team’s new limits are live in every app.');
    expect(said).toContain('5,000 automation runs a month for each member across the team’s items');
    expect(said).toContain('250 automation rules for each member, up from 25.');
    expect(said).toContain('500 AI credits a member, 250 GB of images');
  });

  it('waits while the pointer rests on it or the keyboard is inside it, then runs out what was left', () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    render(
      <SubscribedNotice tier="pro" teamName={null} pricingHref="/pricing" onDismiss={dismiss} />,
    );
    const notice = screen.getByRole('status');
    act(() => void vi.advanceTimersByTime(SUBSCRIBED_NOTICE_MS - 1000));
    fireEvent.pointerEnter(notice);
    act(() => void vi.advanceTimersByTime(SUBSCRIBED_NOTICE_MS * 2));
    expect(dismiss).not.toHaveBeenCalled();
    fireEvent.pointerLeave(notice);
    fireEvent.focus(screen.getByRole('button', { name: 'Dismiss' }));
    act(() => void vi.advanceTimersByTime(SUBSCRIBED_NOTICE_MS));
    expect(dismiss).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByRole('button', { name: 'Dismiss' }));
    act(() => void vi.advanceTimersByTime(999));
    expect(dismiss).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('goes at once when dismissed', () => {
    const dismiss = vi.fn();
    render(
      <SubscribedNotice tier="pro" teamName={null} pricingHref="/pricing" onDismiss={dismiss} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
