// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Portal } from './Portal';

// A menu measures itself in its layout effect (PortalMenu); the portal must already be in the page by then, or the
// menu never learns where to go and stays off screen.
describe('Portal', () => {
  it('is in the page by its owner’s first layout effect', () => {
    let measured: boolean | null = null;
    function Owner() {
      const ref = useRef<HTMLDivElement>(null);
      const [, setSeen] = useState(false);
      useLayoutEffect(() => {
        measured = ref.current !== null && document.body.contains(ref.current);
        setSeen(true);
      }, []);
      return (
        <Portal>
          <div ref={ref}>menu</div>
        </Portal>
      );
    }
    render(<Owner />);
    expect(measured).toBe(true);
  });
});
