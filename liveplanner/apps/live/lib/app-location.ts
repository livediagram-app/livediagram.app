// The app's one way to leave a page (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workspace frame"):
// every full navigation the Explorer makes, and every router push and replace, asks the navigation interceptor first.
// Outside a workspace frame there is none and the browser goes as asked. Inside one, the frame takes the href and
// moves itself (history.pushState), so a frame never loads another page and never loses its session.

// Answers whether it took the move; a move it does not take goes ahead as asked.
export type AppNavigationInterceptor = (href: string, opts: { replace: boolean }) => boolean;

let interceptor: AppNavigationInterceptor | null = null;

// Installs the interceptor; the returned function removes it, and only it.
export function setAppNavigationInterceptor(next: AppNavigationInterceptor): () => void {
  interceptor = next;
  return () => {
    if (interceptor === next) interceptor = null;
  };
}

// Whether the interceptor took the move.
export function interceptAppNavigation(href: string, replace: boolean): boolean {
  return interceptor?.(href, { replace }) ?? false;
}

// `window.location.replace`, unless the frame takes the move (as a replace).
export function replaceAppLocation(href: string): void {
  if (interceptAppNavigation(href, true)) return;
  window.location.replace(href);
}

// `window.location.assign`, unless the frame takes the move.
export function assignAppLocation(href: string): void {
  if (interceptAppNavigation(href, false)) return;
  window.location.assign(href);
}
