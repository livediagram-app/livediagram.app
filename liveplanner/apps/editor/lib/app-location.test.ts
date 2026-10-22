// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assignAppLocation,
  replaceAppLocation,
  interceptAppNavigation,
  setAppNavigationInterceptor,
} from './app-location';

describe('assignAppLocation', () => {
  const assign = vi.fn();
  const replace = vi.fn();
  const realLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: realLocation, configurable: true });
    assign.mockReset();
    replace.mockReset();
  });

  const stubLocation = () =>
    Object.defineProperty(window, 'location', {
      value: { ...realLocation, assign, replace },
      configurable: true,
    });

  it('goes where it is asked when no frame intercepts', () => {
    stubLocation();

    assignAppLocation('/project/d1');

    expect(assign).toHaveBeenCalledWith('/project/d1');
  });

  it('hands the move to the interceptor, which takes it or passes it on', () => {
    stubLocation();
    const taken: string[] = [];
    const remove = setAppNavigationInterceptor((href) => {
      taken.push(href);
      return href.startsWith('/explorer');
    });

    assignAppLocation('/explorer/recent');
    assignAppLocation('/help');
    remove();
    assignAppLocation('/explorer/home');

    expect(taken).toEqual(['/explorer/recent', '/help']);
    expect(assign.mock.calls).toEqual([['/help'], ['/explorer/home']]);
  });

  it('tells the interceptor a replace from a push, and removes only its own interceptor', () => {
    const seen: boolean[] = [];
    const first = setAppNavigationInterceptor((_href, { replace }) => {
      seen.push(replace);
      return true;
    });
    const second = setAppNavigationInterceptor(() => false);

    first();
    expect(interceptAppNavigation('/x', true)).toBe(false);
    second();
    expect(interceptAppNavigation('/x', false)).toBe(false);
    expect(seen).toEqual([]);
  });

  it('replaces in place, and asks the frame for a replace', () => {
    stubLocation();
    const seen: boolean[] = [];
    const remove = setAppNavigationInterceptor((href, opts) => {
      seen.push(opts.replace);
      return href === '/explorer/team?id=t1';
    });

    replaceAppLocation('/explorer/team?id=t1');
    replaceAppLocation('/sign-in/');
    remove();

    expect(seen).toEqual([true, true]);
    expect(replace.mock.calls).toEqual([['/sign-in/']]);
  });
});
