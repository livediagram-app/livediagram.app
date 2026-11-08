// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { BODY_END_ATTR, useBodyEndAnchor } from './useBodyEndAnchor';

// docs/specs/026-plan/blueprints/plan-board.md "Body end anchor".
afterEach(cleanup);

function Editor({ overlay }: { overlay: boolean }) {
  useBodyEndAnchor();
  return (
    <div data-testid="root">
      {overlay ? createPortal(<div data-testid="overlay" />, document.body) : null}
    </div>
  );
}

describe('the body end anchor', () => {
  it('keeps the editor from ever being the body’s last element, as overlays come and go', () => {
    const { rerender, getByTestId, unmount } = render(<Editor overlay={false} />);
    const host = getByTestId('root').parentElement!;
    const anchor = document.querySelector(`[${BODY_END_ATTR}]`)!;
    expect(anchor).not.toBeNull();
    expect(document.body.lastElementChild).toBe(anchor);
    expect(document.body.lastElementChild).not.toBe(host);
    rerender(<Editor overlay />);
    expect(document.body.lastElementChild).toBe(getByTestId('overlay'));
    rerender(<Editor overlay={false} />);
    expect(document.body.lastElementChild).toBe(anchor);
    unmount();
    expect(document.querySelector(`[${BODY_END_ATTR}]`)).toBeNull();
  });
});
