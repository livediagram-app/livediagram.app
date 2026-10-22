// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useToolAnchor } from './useToolAnchor';

// docs/specs/031-photo/photo-pages.md "The options flyout": the options hang from the tool in hand's button.
afterEach(() => document.body.replaceChildren());

describe('the tool in hand’s anchor', () => {
  it('is the pressed button’s rect in the photo tools, and none with no tool in hand', async () => {
    const rail = document.createElement('div');
    rail.setAttribute('data-photo-rail', '');
    const button = document.createElement('button');
    button.setAttribute('aria-pressed', 'true');
    button.getBoundingClientRect = () => ({ left: 400, right: 436, bottom: 120 }) as DOMRect;
    rail.append(button);
    document.body.append(rail);
    const props: { tool: string | null } = { tool: 'lasso' };
    const { result, rerender } = renderHook(({ tool }) => useToolAnchor(tool), {
      initialProps: props,
    });
    await waitFor(() => expect(result.current).toEqual({ left: 400, right: 436, bottom: 120 }));
    rerender({ tool: null });
    expect(result.current).toBeNull();
  });

  it('is the category button holding the tool when the tool has no button of its own', async () => {
    const rail = document.createElement('div');
    rail.setAttribute('data-photo-rail', '');
    const category = document.createElement('button');
    category.setAttribute('data-photo-holds', '');
    category.getBoundingClientRect = () => ({ left: 900, right: 990, bottom: 110 }) as DOMRect;
    rail.append(category);
    document.body.append(rail);
    const { result } = renderHook(() => useToolAnchor('rectangle'));
    await waitFor(() => expect(result.current).toEqual({ left: 900, right: 990, bottom: 110 }));
  });
});
