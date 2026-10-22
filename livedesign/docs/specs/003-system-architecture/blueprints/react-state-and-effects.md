# React state and effects blueprint

Derived from [React state and effects](../react-state-and-effects.md): the sections "Rendering in the browser only",
"Animating a state change", "Fragments and DOM events" and the React Compiler's reach. The older rules (pure render,
effect events, `useLatest`, the clocks) are enforced by the hooks lint and need no blueprint.

## Domain and naming

| Term                | Identifier                                          | Meaning                                                                 |
| ------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Browser-only render | `use(browser())`                                    | Suspends during the static prerender; never in the browser              |
| Prerender fallback  | the nearest `<Suspense fallback>`                   | What the exported HTML holds where a browser-only component sits        |
| Transition type     | `addTransitionType(type)`                           | Why a transition runs; a surface keys its View Transition classes by it |
| Surface boundary    | `<ViewTransition default="none" update={…}>`        | The one place a surface's View Transition is declared                   |
| Reduced motion      | `prefersReducedMotion()`                            | The OS setting or the in-app preference (`.reduce-motion` on `<html>`)  |
| Asked-for state     | `asked` (a ref beside the handler)                  | What a handler last asked for while React holds its transition          |
| Fragment ref        | `<Fragment ref>`, `FragmentInstance`                | A group handle on a component's children, with no wrapper node          |
| Build year          | `process.env.NEXT_PUBLIC_BUILD_YEAR` (`BUILD_YEAR`) | The year the site was built, inlined at build time                      |

## Behaviour and state

### Browser-only rendering: the sites

Every render-time read of a browser global is converted; reads in effects, handlers, external-store snapshots and
module code that render does not consume stay as they are. A component whose prerendered HTML matters (an LCP
page) never suspends whole: its URL reads use an external store whose server snapshot is "nothing" instead.

| Site                                                                          | Reads                               | Becomes                                                                           |
| ----------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| `apps/live/app/explorer/useExplorerState.ts`                                  | the URL, preferences                | `use(browser())`; no hydration flag                                               |
| `apps/live/app/oauth/consent/page.tsx`, `apps/live/app/oauth/device/page.tsx` | `location` (return path)            | `use(browser())` in the signed-out branch, under the page's Suspense              |
| `apps/live/app/new/page.tsx` (`initialPlacement`)                             | `location.search`                   | `useSyncExternalStore` (`placementContextFromSearch`), like the bypass            |
| `apps/live/components/panels/TeamSharedDocuments.tsx` (`spot`)                | `location.search`                   | `use(browser())` before the state                                                 |
| `ShareDialog`, `TeamInviteLinkDialog`                                         | `location.origin`                   | `use(browser())`, then `window.location.origin`                                   |
| `CanvasThemeDialog` (`useBrushAnchor`)                                        | `innerWidth`, a box                 | `use(browser())` before the state (read once as it opens)                         |
| `useEditorDialogs`, `useEyeDropper`, `useShareLinks`, `useEditorViewport`     | the URL, `EyeDropper`, `innerWidth` | `use(browser())` (`useShareLinks`: the guard goes; its URL is built in handlers)  |
| `apps/live/app/document/[id]/page.tsx`, `apps/live/app/embed/page.tsx`        | (the editor suspends)               | `<Suspense fallback={<OpeningScreen />}>`: the screen the prerender always showed |
| `CardFinderPanel` (`finePointer`)                                             | `(pointer: fine)`                   | `useMediaQuery('(pointer: fine)')`                                                |
| `arrow-handles.tsx` (`COARSE_POINTER`)                                        | `(pointer: coarse)`                 | `useMediaQuery('(pointer: coarse)')` in each handle                               |
| `EditorContextMenu` (`anchorBottom`)                                          | `innerHeight`                       | `useViewportHeight()`                                                             |
| `StartAgainTray` (`pillPlace` default argument)                               | `innerHeight`                       | a required argument; the caller passes `useViewportHeight()`                      |
| `useViewportWidth`, `useViewportHeight`                                       | `innerWidth`, `innerHeight`         | `useSyncExternalStore` on `resize`, 0 in the prerender                            |
| `EditorCanvasHost` (`openUp`, in the context-menu handler)                    | `innerHeight`                       | the guard goes: a handler runs in the browser                                     |
| `packages/ui/src/SiteFooter.tsx`                                              | the clock (`new Date()`)            | `NEXT_PUBLIC_BUILD_YEAR`                                                          |

What stays, with where it runs, is the allow-list in `apps/live/render-browser-globals.test.ts`.

### A View Transition from state

1. The handler checks `prefersReducedMotion()`; when true, or when the change does not animate, it applies the
   change plainly and stops.
2. Otherwise it calls `startTransition(() => { addTransitionType(type); apply(); })`.
3. React commits the transition inside `document.startViewTransition`; the surface's boundary names its root
   element, and its `update` (or `enter` / `exit`) class for `type` picks the CSS animation.
4. A handler that steps from the state on screen keeps `asked` (a ref): it steps from `asked ?? onScreen`, writes
   `asked`, and clears it once the state on screen equals it.

### Ref-only wrappers: the sites

| Site                                                      | The wrapper carried          | Becomes                                                          |
| --------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| `apps/live/components/panels/LayerRowMenu.tsx` (two rows) | the confirm popover's anchor | the click's `currentTarget` (`MenuActionRow` hands its click on) |

Stay, carrying more than a ref: `packages/ui/src/Tooltip.tsx` (React pointer and focus handlers, capture-phase
ones among them), `apps/help/components/ArticleShell.tsx` (reads `textContent`) and
`packages/ui/src/timeline/TimelineCalendarView.tsx` (the component's own box).

### The React Compiler's reach

`reactCompiler: true` with `experimental.turbopackRustReactCompiler` comes from `@livedesign/next-config` when an app
passes `reactCompiler: true`, which only `apps/live/next.config.ts` does
([Next.js blueprint](../../016-platform/blueprints/nextjs.md)).

## Interfaces and contracts

```ts
// react-dom
export function browser(): PromiseLike<void>; // use(browser()): suspends on the server only

// react
export function addTransitionType(type: string): void;
export function ViewTransition(props: {
  default?: 'none' | 'auto' | string;
  update?: string | Record<string, string>;
  enter?: string | Record<string, string>;
  exit?: string | Record<string, string>;
  children: React.ReactNode;
}): React.ReactNode;
```

- A `<Suspense>` placed for `use(browser())` takes a fallback with the final box's size and no text a screen reader
  would announce twice.
- `BUILD_YEAR` is a four-digit string; read as `process.env.NEXT_PUBLIC_BUILD_YEAR ?? ''` so a test without it renders
  no year rather than a wrong one.

## Errors and edge cases

| Case                                                     | Handling                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `use(browser())` with no `<Suspense>` above, prerendered | The build fails on the missing boundary; a boundary is added      |
| A browser without View Transitions                       | React applies the change without animating; nothing else differs  |
| A second transition while one animates                   | React holds it; `asked` keeps the handler's steps from being lost |
| A transition skipped (the tab hidden)                    | The change is committed; nothing waits on the animation           |
| A Fragment whose children change                         | `FragmentInstance` follows the current first-level children       |

## Performance and limits

- A View Transition captures its surface twice per change: it is used only for whole-surface swaps (a slide move,
  the start's mode switch), never per keystroke or pointer move.
- `use(browser())` costs nothing in the browser; in the prerender it moves the content after hydration, so a site
  above the fold reserves its size (CLS stays 0).

## Presentation and UX

A browser-only component's fallback is its empty shape (the same box, no content). The start's mode switch and a
slide move animate as their own specs say; under reduced motion both change at once.

## Accessibility

Fallbacks carry no text. Reduced motion (both sources) starts no View Transition.

## Web Experience

- CLS: every prerender fallback reserves its final size; verified per site with the layout-stability check.
- INP: a View Transition's update runs as a transition, so the key or click that starts it paints first.

## Observability

No new log lines: a refused fullscreen and a Trusted Types violation are logged by their own blueprints.

## Testing

| Rule                                     | Test                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Browser-only sites render in the browser | Each site's component test renders the browser value; a server render shows the fallback         |
| No `typeof window` in render             | `apps/live/render-browser-globals.test.ts`: `.tsx` and `use*.ts` guard only where allow-listed   |
| Footer year from the build               | `packages/ui` SiteFooter test renders `BUILD_YEAR`, and no year without it                       |
| Reduced motion starts no transition      | The slide and mode-switch tests stub `prefersReducedMotion` and assert no `startTransition` type |
| Steps count from `asked`                 | `PresentationHost` test: three quick steps land three slides on                                  |
| Ref-only wrappers are gone               | `ShapesFlyout.test.tsx`, `LayerRowMenu.test.tsx`: focus and anchor with no bare node             |

## Constants and configuration

| Constant                 | Value                                       | Provenance                      | Safe range        |
| ------------------------ | ------------------------------------------- | ------------------------------- | ----------------- |
| `NEXT_PUBLIC_BUILD_YEAR` | `String(new Date().getFullYear())` at build | `@livedesign/next-config` `env` | A four-digit year |

## Defaults ledger

D1 to D4 in [DEFAULTS.md](DEFAULTS.md).
