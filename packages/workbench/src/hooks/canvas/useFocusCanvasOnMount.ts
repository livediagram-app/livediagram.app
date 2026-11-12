import { useEffect, type Ref } from 'react';

// Auto-focus the canvas surface on mount so clipboard paste works
// before the user has clicked anywhere. The browser only dispatches
// `paste` events on a focusable element; <main> has tabIndex=-1 to
// be a valid focus target, but it doesn't grab focus by itself.
// Without this, a freshly-loaded editor swallows Cmd/Ctrl+V silently
// until the first canvas click. preventScroll keeps the viewport
// from jumping if the page was scrolled at load time. Each editor's Canvas calls it.
export function useFocusCanvasOnMount(mainRef: Ref<HTMLElement>): void {
  useEffect(() => {
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    node?.focus({ preventScroll: true });
  }, [mainRef]);
}
