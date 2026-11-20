// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GIF_OMIT_SELECTOR } from '@/lib/gif-export/gif-omit';
import { GifOmit } from './GifOmit';

afterEach(cleanup);

// docs/specs/020-import-export/blueprints/animated-gif-export.md "The snapshot", step 3.
describe('GifOmit', () => {
  it('marks what it holds as editor-only, adding no box', () => {
    const { container } = render(
      <GifOmit>
        <span>cursor</span>
      </GifOmit>,
    );
    const wrapper = container.firstElementChild!;
    expect(wrapper.matches(GIF_OMIT_SELECTOR)).toBe(true);
    expect(wrapper.className).toBe('contents');
    expect(wrapper.textContent).toBe('cursor');
  });
});
