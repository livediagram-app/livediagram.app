// @vitest-environment jsdom
// subscription.md "The pricing page": Everything Else Is Completely Free, with a few examples behind a closed accordion.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PricingFreeFeatures } from './PricingFreeFeatures';

afterEach(cleanup);

describe('PricingFreeFeatures', () => {
  it('leads its examples with unlimited documents in every app', () => {
    render(<PricingFreeFeatures />);
    expect(
      screen.getByRole('heading', { name: 'Everything Else Is Completely Free' }),
    ).toBeTruthy();
    expect(screen.getByText('See Some Examples')).toBeTruthy();
    const items = [...document.querySelectorAll('li')].map((li) => li.textContent);
    expect(items[0]).toBe('Unlimited documents in every app');
  });
});
