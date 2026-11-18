'use client';

import { lazy, Suspense, useState, type ComponentProps, type ComponentType } from 'react';

// A panel or dialog drawn from its own chunk the first time it is opened, kept out of the page's first load. Its
// opener calls `preload` ahead of the press (a pointer coming over it, it taking focus, a menu that offers it
// opening), so by the press the code is in and the panel draws in the press's own commit, as a static import would,
// with nothing in between to take focus or flash. Opened before then, it draws nothing until its code lands. A load
// that fails (offline) draws nothing rather than throwing into the screen around it; a failed preload is forgotten,
// so the press tries again. Content a page cannot do without (`onFail: 'throw'`) throws a failed load into the error
// boundary around it instead, as a `next/dynamic` component would. Content that shows a loading face while its code
// lands (a board's loading cover) names it as `fallback`, as a `next/dynamic` component's `loading`.
export type LazyPanelOptions = {
  /** What a failed load draws: nothing (the default, for a panel), or the error, thrown to the boundary around it. */
  onFail?: 'nothing' | 'throw';
  /** What it draws while its code loads: nothing (the default), or this. */
  fallback?: ComponentType;
};

export type LazyPanel<P extends object> = ComponentType<P> & {
  /** Fetches the panel's code without drawing it. Never rejects. */
  preload: () => Promise<void>;
};

export function lazyPanel<P extends object>(
  name: string,
  load: () => Promise<ComponentType<P>>,
  { onFail = 'nothing', fallback: Fallback }: LazyPanelOptions = {},
): LazyPanel<P> {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;
  const fetch = () =>
    (pending ??= load().then(
      (component) => (loaded = component),
      (err: unknown) => {
        pending = null;
        throw err;
      },
    ));
  const Lazy = lazy(() =>
    fetch().then(
      (component) => ({ default: component }),
      (err: unknown) => {
        if (onFail === 'throw') throw err;
        console.warn(`[${name}] panel code failed to load`, err);
        return { default: (() => null) as ComponentType<P> };
      },
    ),
  );
  function Panel(props: P) {
    // Decided once, as it mounts: switching between the two later would remount the panel and lose its state.
    const [Loaded] = useState(() => loaded);
    if (Loaded) return <Loaded {...props} />;
    return (
      <Suspense fallback={Fallback ? <Fallback /> : null}>
        <Lazy {...(props as ComponentProps<typeof Lazy>)} />
      </Suspense>
    );
  }
  Panel.displayName = `LazyPanel(${name})`;
  Panel.preload = () =>
    fetch().then(
      () => {},
      () => {},
    );
  return Panel;
}
