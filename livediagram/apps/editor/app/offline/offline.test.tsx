// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from './page';

afterEach(() => vi.unstubAllGlobals());

describe('/offline', () => {
  it("sends people to the Explorer's This Browser view, its query and hash kept", () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { search: '?convert=sync&item=d1', hash: '#x', replace });
    render(<Page />);
    expect(replace).toHaveBeenCalledWith('/explorer/offline?convert=sync&item=d1#x');
  });
});
