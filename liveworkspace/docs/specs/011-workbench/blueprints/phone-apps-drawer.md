# The phone's top row and Apps drawer: blueprint

Derived from [phone-apps-drawer.md](../phone-apps-drawer.md). The spec decides; this file only adds engineering
precision. Paths are relative to the repository root.

| File                                                                          | Role                                                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages/workbench/src/components/chrome/phone-apps/phone-apps-store.ts`     | The module store the corner actions publish to on a phone; `usePublishPhoneApps`, `usePhoneApps`       |
| `packages/workbench/src/components/chrome/phone-apps/phone-apps-tiles.ts`     | `phoneAppsTiles`: which tiles show, from the published actions, the call, the Inbox and the app (pure) |
| `packages/workbench/src/components/chrome/phone-apps/ExplorerMenuButtons.tsx` | The menu card's buttons: the hamburger from the phone breakpoint up, the logo and Apps below it        |
| `packages/workbench/src/components/chrome/phone-apps/AppsButton.tsx`          | Apps, its unread dot, and the drawer while open                                                        |
| `packages/workbench/src/components/chrome/phone-apps/AppsDrawer.tsx`          | The drawer's header, tiles, the item's own actions and the Account row, in `PhoneDrawer`               |
| `packages/workbench/src/components/item-call/useItemCallAction.ts`            | Start or join the item's call: shared by `ItemCallButton` and the Call tile                            |
| `packages/workbench/src/components/chrome/EditorCornerActions.tsx`            | On a phone draws no card (clears its room) and publishes its props instead                             |
| `liveknowledge/apps/editor/components/chrome/TopRowActions.tsx`               | The same for liveknowledge's top-row actions                                                           |
| `packages/workbench/src/components/chrome/phone-toolbar-items.ts`             | `PHONE_TOP_ROW_CARD`: a phone's 56 px card, 44 px items                                                |
| Each editor's `components/chrome/ToolbarExplorerButton.tsx`                   | Draws `ExplorerMenuButtons`; on a phone passes no `logo` to its menu card (the logo is in the card)    |

## The store

- `PhoneAppsSnapshot`: `itemName`, `shareWords`, `showShare`, `onOpenShare`, `onMakeCopy`, `copying`, `present`,
  `onOpenAccount`, `hasCall`, `offline`, and `slots` (the approval, lead action and share action nodes).
- `publishPhoneApps(next | null)` keeps the newest snapshot and tells two sets of listeners: `shape` listeners only when
  `snapshotKey(next)` changes (booleans and words, never closures), `live` listeners always. The Apps button reads the
  shape; the open drawer reads live, so its slots and handlers are never stale.
- `usePublishPhoneApps(snapshot, phone)`: a layout effect publishing each render while `phone`, and `null` on a desktop
  and on unmount.

## EditorCornerActions on a phone

`EditorCornerActions` reads `useIsMobileViewport()`. On a phone it publishes and renders only its zero-height layer and
`AskCitationBar`; the card (`CornerCard`, the old body) unmounts, and its unmount already clears `--corner-card-room`
and `--corner-card-span` and sends `CORNER_CARD_EVENT` (`sayCornerCard(null)` a frame later, when the card is gone).

## The menu card

- `ExplorerMenuButtons({ app, open, onToggle, buttonRef, itemId, inbox })`. From the phone breakpoint up it is the
  hamburger (`h-9 w-9`, the Inbox badge, `aria-label` `Explorer, n in Inbox`). On a phone: the logo button
  (`BrandMark` in an `h-9 w-9` button, which `PHONE_TOP_ROW_CARD` grows to 44 px; `aria-label="Explorer"`,
  `aria-expanded`, the same `onToggle` with itself as the anchor, `data-phone-logo`) and `AppsButton`.
- Both track `UI·Opened·ToolbarExplorer` on opening, as the hamburger did.
- `AppsButton`: `aria-label` `Apps` or `Apps, n in Inbox`, `aria-haspopup="dialog"`, `aria-expanded`; the dot is a
  `span` with `data-unread-dot`. Opening tracks `UI·Opened·PhoneApps`.

## The drawer

- `PhoneDrawer` with `layer="modal"`, `labelledBy` the header's `<h2>`, `attrs={{ 'data-phone-apps': '' }}`.
- Tiles from `phoneAppsTiles({ snapshot, call, inboxCount, app, signedIn })`, each `{ id, label, href? , badge? }`;
  links render as `<a>` (Explorer `explorerItemHref(itemId)`, Inbox `explorerHref('inbox')`), the rest as buttons that
  close the drawer, then act.
- Copy Link: `navigator.clipboard.writeText(location.href)`, then the shared toast (`Link copied`), or `Couldn't copy
the link` when refused.
- The slots row is `data-phone-apps-slots`; `corner-actions.css` shows the `phone:sr-only` names inside it.
- Account: `useDeferredAuth()`; signed in, a `PictureDisc` in `accountAvatarFill`; signed out, a link to
  `useAuthHrefs().signInHref`; nothing until `authLoaded`.

## Tests

- `phone-apps-tiles.test.ts`: the tiles per role (Editor, Participant or Viewer, guest), Present and Share following
  the corner card's props, Call only with a call source that may start or a live call, Copy Link hidden Offline, Inbox
  only signed in and never for livehuddle.
- `phone-apps-store.test.ts`: shape listeners hear a change of words or tiles, not a new closure; live ones hear both.
- `ExplorerMenuButtons.test.tsx`: the hamburger on a desktop; the logo (opening the panel) and Apps on a phone; the
  unread dot and its name.
- `AppsDrawer.test.tsx`: the header words, Explorer is a link to the Explorer page (no panel opens), Share closes and
  opens Share, Copy Link copies, the Account row opens Account, Sign In for a guest.
- `EditorCornerActions.test.tsx`: no card on a phone, the room cleared, the props published; the card on a desktop.
