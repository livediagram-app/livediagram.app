# Menus: blueprint

Derived from [Menus](../menus.md). The spec decides; this file only adds engineering precision. Defaults applied where
the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                        | Role                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/ui/src/menu/menu-constants.ts`                    | Every selector, attribute and timing, named                                                 |
| `packages/ui/src/menu/menu-keys.ts`                         | Pure keyboard model: key to intent, index stepping, typeahead, initial index                |
| `packages/ui/src/menu/input-modality.ts`                    | The last interaction (key or pointer) and the last focused element, tracked on the document |
| `packages/ui/src/menu/menu-dom.ts`                          | DOM reads: a menu's own items, focusables, tabbable neighbour, focus ownership              |
| `packages/ui/src/menu/menu-tree.ts`                         | `MenuTreeContext`: the kind and id of the menu a component renders inside                   |
| `packages/ui/src/menu/useMenu.ts`                           | Command menu hook: roles, label, initial focus, keys, Tab, focus return                     |
| `packages/ui/src/menu/useMenuButton.ts`                     | Trigger state and props: `aria-haspopup`, `aria-expanded`, Down / Up Arrow to open          |
| `packages/ui/src/menu/useControlMenu.ts`                    | Control menu hook: dialog role, keyboard-only initial focus, Escape, focus return           |
| `packages/ui/src/menu/index.ts`                             | Public surface, re-exported from `packages/ui/src/index.ts`                                 |
| `packages/tailwind-config/theme.css`                        | The inset menu focus ring; the app-wide ring at brand 600 in light                          |
| `apps/live/components/primitives/PortalMenu.tsx`            | Anchored menu (command or control) and its list rows, each role-aware                       |
| `apps/live/components/primitives/MenuTiles.tsx`             | The tile family: `MenuToolbar`, `MenuToolButton`, `MenuTile`, `MenuTileGrid`, role-aware    |
| `apps/live/components/primitives/menu-item-props.ts`        | `useMenuItemProps`: a row's role, `tabIndex` and states from the menu it sits in            |
| `apps/live/components/primitives/usePortalMenuPlacement.ts` | An anchored menu's position, viewport clamp and outside-press dismissal                     |
| `apps/live/components/primitives/MenuFlyoutSection.tsx`     | Submenu (in a command menu) or sub-panel (in a control menu)                                |
| `apps/live/components/primitives/MenuFlyoutPanel.tsx`       | The flyout's surface: `menu` or `dialog`                                                    |
| `apps/live/components/primitives/MenuCheckRow.tsx`          | `menuitemcheckbox`, roving                                                                  |
| `apps/live/components/primitives/useRowMenu.ts`             | Built on `useMenuButton`                                                                    |
| `apps/live/components/primitives/EllipsisTriggerButton.tsx` | Accepts `onKeyDown` for Down / Up Arrow                                                     |
| `apps/live/components/palette/ContextMenu.tsx`              | Control menu at a point (element, selection, cell)                                          |
| `apps/live/components/chrome/TabPortalMenu.tsx`             | Tab and Canvas control menu                                                                 |
| `apps/live/components/panels/LayerRowMenu.tsx`              | Layer control menu                                                                          |
| `apps/live/components/canvas/ElementEllipsisMenu.tsx`       | Element quick menu (`kind="command"`) or session settings (`kind="control"`)                |
| `apps/live/components/canvas/LockedElementMenu.tsx`         | Command menu, no trigger                                                                    |
| `apps/live/components/chrome/ZoomMenu.tsx`                  | Hover-open command menu with a button of its own                                            |
| `apps/live/components/chrome/editor-mode/ModeMenuChip.tsx`  | One-of-a-set command menu; its own key handling deleted                                     |
| `apps/live/components/chrome/AuthControls.tsx`              | Account command menu                                                                        |
| `apps/live/components/chrome/EmbedChrome.tsx`               | Embed tab command menu                                                                      |
| `apps/live/components/chrome/TabModeMenuSection.tsx`        | The tab's Mode, inside the Tab control menu: toggle buttons                                 |
| `apps/live/components/dialogs/ShareCopyMenu.tsx`            | Command menu, or control menu when it carries a header control                              |
| `apps/live/components/canvas/whiteboard/ColourPicker.tsx`   | Custom colour command menu; its own focus and Escape deleted                                |
| `apps/live/hooks/canvas/useEditorKeyboardShortcuts.ts`      | Canvas shortcuts stand down inside a menu surface                                           |
| `apps/live/components/canvas/SelectionPopover.tsx`          | More actions: `aria-haspopup="dialog"` and the stable id `selection-more-actions`           |
| `apps/live/lib/element-names.ts`                            | `shapeKindLabel`: names the Shape tiles of the element and selection menus                  |
| `packages/ui/src/ProductNav.tsx`                            | Product switcher command menu                                                               |
| `apps/telemetry/app/StickyWindowBar.tsx`                    | View picker command menu                                                                    |

## Domain and naming

| Term           | Identifier                                                       | Meaning                                                             |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Menu kind      | `MenuKind` (`'command' \| 'control'`)                            | How a menu is built and announced                                   |
| Command menu   | `useMenu`, `role="menu"`, `data-menu-surface="command"`          | A menu of menu items only                                           |
| Control menu   | `useControlMenu`, `role="dialog"`, `data-menu-surface="control"` | A menu holding at least one control                                 |
| Menu surface   | `data-menu-surface`, `MENU_SURFACE_ATTR`                         | Any element that is a menu of either kind, the flyouts included     |
| Parent surface | `data-menu-parent`, `MENU_PARENT_ATTR`                           | The id of the menu a submenu or sub-panel opened from               |
| Menu item      | `MENU_ITEM_SELECTOR`                                             | `menuitem`, `menuitemcheckbox` or `menuitemradio`                   |
| Own items      | `menuItemsOf(menu)`                                              | Items whose nearest menu surface is this one and that are not inert |
| Menu label     | `data-menu-label`, `MENU_LABEL_ATTR`                             | A `MenuHeader` naming its menu                                      |
| Key intent     | `MenuKeyIntent`                                                  | What a key press means to a command menu                            |
| Initial focus  | `MenuInitialFocus` (`'checked' \| 'first' \| 'last' \| 'none'`)  | Where focus lands on open; `checked` falls back to the first item   |
| Return target  | `returnTarget` (in the hooks)                                    | Where focus goes when the menu closes holding it                    |
| Menu tree      | `MenuTreeContext`, `MenuTree` (`{ kind, id, closeTree }`)        | The menu a component renders inside; `null` outside any menu        |

The kind is read from `MenuTreeContext`, never passed to rows: a row primitive inside a command menu is a menu item, the
same primitive inside a control menu or outside any menu is a button. Banned: "popover menu", "dropdown menu", "panel
menu" for either kind, `role="menu"` written by hand outside the hooks.

## Behaviour and state

### Keyboard model (`menu-keys.ts`, pure)

`menuKeyIntent(key: MenuKeyEvent, at: { inSubmenu: boolean; onSubmenuTrigger: boolean }): MenuKeyIntent | null`, where
`MenuKeyEvent = { key, shiftKey, altKey, ctrlKey, metaKey }`:

| Key (no Ctrl, Meta, Alt)             | Intent                                       |
| ------------------------------------ | -------------------------------------------- |
| `ArrowDown` / `ArrowUp`              | `{ kind: 'move', to: 'next' \| 'previous' }` |
| `Home` / `End`                       | `{ kind: 'move', to: 'first' \| 'last' }`    |
| `Enter`, `' '`                       | `{ kind: 'activate' }`                       |
| `ArrowRight` on a submenu trigger    | `{ kind: 'enter-submenu' }`                  |
| `ArrowLeft` in a submenu             | `{ kind: 'leave-submenu' }`                  |
| `Escape`                             | `{ kind: 'close' }`                          |
| `Tab` (Shift reverses)               | `{ kind: 'tab', backwards: shiftKey }`       |
| one printable character (not space)  | `{ kind: 'type', char: key.toLowerCase() }`  |
| anything else, or with Ctrl/Meta/Alt | `null`: the browser keeps it                 |

- `moveIndex(current, count, to)`: `next` from `-1` is `0`; wraps both ways; `count === 0` returns `-1`.
- `typeaheadQuery(prev: { query; at }, char, now)`: appends while `now - at < MENU_TYPEAHEAD_RESET_MS`, else restarts.
- `typeaheadIndex(labels, current, query)`: lower-cased `startsWith`, searching from `current + 1` and wrapping; a query
  of one repeated letter (`"ee"`) searches for that letter from `current + 1`, which cycles. `-1` when none matches;
  focus then stays.
- `initialIndex(checked: readonly boolean[], focus)`: `none` is `-1`; `last` is the last; `checked` is the first checked
  index, else `0`; `first` is `0`; an empty list is `-1`.

### `useMenu(options)` (command menus)

Options: `onClose()`, `open = true`, `trigger?: HTMLElement | null`, `initialFocus = 'checked'`, `label?: string`.
Returns `{ attach, element, tree, surfaceProps }`; the host destructures it, spreads `surfaceProps`
(`{ id, role: 'menu', tabIndex: -1, 'data-menu-surface': 'command', 'data-menu-parent'?, 'aria-label'? }`) and passes `attach`
as the menu element's callback ref, and wraps its children in `<MenuTreeContext.Provider value={tree}>`. No ref object is
returned and the callback is not called `ref`: the React compiler lint treats an object holding one as a ref and flags
every read of it during render. A host that also measures the element merges the two in a `useCallback`.

| #   | When                                    | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Element appears with `open`             | Records `returnTarget` (`focusedOutside`: the focused element; on `body`, the last focused element if it has gone), then focuses `initialIndex` of the own items (checked = a `menuitemradio` with `aria-checked="true"`) with `preventScroll`, unless a text edit holds focus. A menu still becoming visible (a `visibility` transition) is retried each frame, up to `MENU_FOCUS_RETRY_FRAMES`, until focus is in the menu or has moved anywhere else |
| M2  | Every commit                            | Names the menu: a `data-menu-label` it owns (`aria-labelledby`), else the `label` option (`aria-label`), else the trigger (`aria-labelledby` its id, or `aria-label` its accessible name)                                                                                                                                                                                                                                                               |
| M3  | Open, with a trigger                    | Sets `aria-controls` on the trigger to the menu id unless the trigger manages its own; removes what it set on close                                                                                                                                                                                                                                                                                                                                     |
| M4  | `keydown` on the menu (native listener) | Resolves the intent against the focused own item; a non-null intent is `preventDefault` + `stopPropagation`                                                                                                                                                                                                                                                                                                                                             |
| M5  | `move`, `type`                          | Focuses the target item                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| M6  | `activate`                              | `aria-disabled="true"`: nothing. An expanded submenu trigger: focus the submenu's first item. Else `item.click()`; a Space `keyup` that follows is cancelled                                                                                                                                                                                                                                                                                            |
| M7  | `enter-submenu`                         | Expanded: focus the submenu's first item. Else `item.click()` (the submenu focuses itself, M1)                                                                                                                                                                                                                                                                                                                                                          |
| M8  | `leave-submenu`, `close`                | `onClose()`; focus returns by M10                                                                                                                                                                                                                                                                                                                                                                                                                       |
| M9  | `tab`                                   | In a submenu: the parent tree's `closeTree(backwards)`. At the root: focus `tabbableNeighbour(returnTarget ?? trigger, backwards)` (else the target itself), then `onClose()`                                                                                                                                                                                                                                                                           |
| M10 | Element goes away or `open` turns false | If `ownsFocus(menu)` (in it, or in a surface whose parent chain leads to it): `returnFocusAfterCommit`: `returnFocus` at once (`returnTarget` if connected, else the trigger, else next frame the element with their id), and again after the commit if focus is back in the menu or on `body` (React restores the prior focus when it is still mounted)                                                                                                |
| M11 | `focusout` to a related target          | Outside the menu and its submenus (`ownsFocus`): `onClose()`; a null related target (a press that focuses nothing) is ignored                                                                                                                                                                                                                                                                                                                           |

A submenu is a `useMenu` whose `MenuTreeContext` parent has `kind === 'command'`.

### `useMenuButton(options?)`

State `{ open, initialFocus }`, a callback-ref'd `trigger` element. `triggerProps`: `ref`, `aria-haspopup="menu"`,
`aria-expanded`, `onClick` (toggle, `initialFocus = 'checked'`), `onKeyDown` (closed: `ArrowDown` opens at `checked`,
`ArrowUp` at `last`, both `preventDefault`). Also `openMenu(focus)`, `close()`, `toggle()`, and `setTrigger` /
`onTriggerKeyDown` for a trigger that writes its own props (destructured, for the same lint reason as `attach`).
`useRowMenu` keeps its own state (its callers read `triggerRef`) and adds `onKeyDown`: Down or Up Arrow opens the menu,
which lands on its first item (D59).

### `useControlMenu(options)` (control menus)

Options: `onClose()`, `onEscape?()` (default `onClose`), `trigger?`, `label: string`, `focusOnOpen?: boolean` (default:
`openedFromKeyboard()`). Returns `{ attach, element, tree, surfaceProps }` with `{ id, role: 'dialog', tabIndex: -1,
'aria-label', 'data-menu-surface': 'control', 'data-menu-parent'? }` (no `aria-modal`: false is the default).

| #   | When              | Does                                                                                                                                                  |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Element appears   | Records `returnTarget`; with `focusOnOpen` and no text edit, focuses the first focusable with `preventScroll`                                         |
| C2  | Escape            | Root: a `document` listener that skips a `defaultPrevented` event. Sub-panel: a listener on its element that `preventDefault`s. Both call `onClose()` |
| C3  | Element goes away | As M10                                                                                                                                                |

`openedFromKeyboard()` is true when the last interaction was a key press rather than a pointer press, tracked by
`input-modality.ts` on the document (D51).

### Hosts

| Host                                                                           | Kind                                                 | Return target, trigger            |
| ------------------------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------- |
| `PortalMenu` (primitives)                                                      | `surface` prop: `'command'` (default) or `'control'` | `anchor` is the trigger           |
| `MenuFlyoutSection`                                                            | The parent tree's kind                               | Its row is the trigger            |
| `ContextMenu`                                                                  | Control, `label` prop                                | None: the focused element at open |
| `TabPortalMenu` `PortalMenu`                                                   | Control, "Tab menu" / "Canvas menu"                  | `anchor` (tab ⋯) or none (canvas) |
| `LayerRowMenu`                                                                 | Control, "<layer> layer menu"                        | None                              |
| `ShareCopyMenu`                                                                | Control with a header control, else command          | Its button                        |
| Custom colour menu (`ColourPicker`)                                            | Command, "<colour> menu"                             | The swatch                        |
| `ElementEllipsisMenu`                                                          | `kind` prop                                          | Its ⋯                             |
| `LockedElementMenu`                                                            | Command, labelled by "In use"                        | None                              |
| `ZoomMenu`                                                                     | Command, `initialFocus` `none` on hover              | The percentage button             |
| `ModeMenuChip`, `AuthControls`, `EmbedChrome`, `ProductNav`, `StickyWindowBar` | Command                                              | Their trigger                     |

### Row primitives by kind

| Primitive              | In a command menu                                                                                            | Elsewhere (unchanged)              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `MenuActionRow`        | `menuitem`, `tabIndex -1`; disabled: `aria-disabled`, focusable                                              | `button`; disabled `span`          |
| `MenuTile`             | `menuitem`; with `active` set: `menuitemcheckbox` + `aria-checked`; disabled: `aria-disabled`, click ignored | `button`, `aria-pressed`, disabled |
| `MenuToolButton`       | As `MenuTile`                                                                                                | `button`, `aria-pressed`           |
| `MenuActionButton`     | `menuitem`                                                                                                   | `button`                           |
| `MenuAccordionSection` | Header `menuitem` + `aria-expanded`; content `role="group"` `aria-labelledby` the header                     | Disclosure `button`                |
| `MenuHeader`           | Its title span carries the id and `data-menu-label` (M2); the header is `aria-hidden`                        | Unchanged                          |
| `MenuGroupSeparator`   | `role="separator"` exposed                                                                                   | Unchanged                          |
| `MenuCheckRow`         | `menuitemcheckbox`, `tabIndex -1`                                                                            | Same                               |
| `ElementMenuItem`      | `menuitem` (its unused `active` prop and `ElementMenuLabel` are gone)                                        | `button`                           |
| `TabModeMenuSection`   | `menuitemradio` + `aria-checked`                                                                             | `button`, `aria-pressed` (D55)     |
| `FlyoutMobileHeader`   | Its Close is the panel's last item in reading order, drawn first (`order-first`)                             | Same, a button                     |

Collapsed accordion content is `inert` and `aria-hidden` in every kind (Chromium keeps inert content in its tree).

### Canvas

`useEditorKeyboardShortcuts` returns early when `isInMenuSurface(e.target)`.

## Interfaces and contracts

```ts
export type MenuKind = 'command' | 'control';
export type MenuInitialFocus = 'checked' | 'first' | 'last' | 'none';
export type MenuTree = { kind: MenuKind; id: string; closeTree: (backwards: boolean) => void };
export const MenuTreeContext: Context<MenuTree | null>;
export function useMenu(o: UseMenuOptions): MenuHandle<'menu'>;
export function useControlMenu(o: UseControlMenuOptions): MenuHandle<'dialog'>;
export function useMenuButton(): MenuButton;
export function isInMenuSurface(target: EventTarget | null): boolean;
```

- `PortalMenu` gains `surface?: MenuKind`, `label?: string`, `initialFocus?: MenuInitialFocus`.
- `ContextMenu` gains `label: string`. `ElementEllipsisMenu` gains `kind: MenuKind`. `EllipsisTriggerButton` gains
  `onKeyDown`. `MenuFlyoutPanel`'s `FlyoutPanel` gains `trigger` and `kind`.
- Rejections: `useMenu` with no own items opens empty and warns (Observability); an unknown key is `null`.

## Errors and edge cases

| Case                                                    | Handling                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Menu renders before it is positioned (`pos` null)       | Hooks act when the element appears (callback ref), not on mount                                  |
| No own items                                            | No focus moves; `console.warn('[menu] opened with no items', { id })`                            |
| Return target removed (the row was deleted)             | Falls back to the trigger; neither connected: focus stays where the browser puts it              |
| Whole tree closes while focus is in a submenu           | The root owns the focus through `data-menu-parent`, restores to its target first (M10)           |
| Text edit holds focus on open                           | No focus moves (M1, C1)                                                                          |
| The opener unmounts as the menu mounts (More actions)   | `returnTarget` is the gone control; `returnFocus` finds its successor by id the next frame (D58) |
| Safari does not focus a clicked button                  | `returnTarget` is `body`, so the trigger is used                                                 |
| Trigger in a composite widget (tree row, `tabIndex -1`) | Return target is the tree row that held focus, so the tree keeps its one tab stop                |
| Hover-opened menu                                       | `initialFocus: 'none'`; keys still work once focus is inside                                     |
| Pointer-opened control menu                             | No focus moves; Escape on the document still closes it                                           |
| Disabled item                                           | Focusable, announced, never activated                                                            |
| Typeahead finds nothing                                 | Focus stays; the query keeps building until the reset                                            |

## Security and trust

None: no input crosses a trust boundary; labels are rendered text.

## Performance and limits

- Item lookup is one `querySelectorAll` per key press over at most ~40 items (the element menu's open sections): well
  under 1 ms. Nothing runs per frame or per pointer move.
- One native `keydown` listener per open menu; no global listener except a control menu's `document` Escape.

## Presentation and UX

No visual change at rest. The only new paint is the focus ring (Accessibility). Copy added: the control menu names in the
spec. No layout shift: roles and `tabIndex` add no box, and `inert` changes no style.

## Accessibility

- Roles, states and properties as in Behaviour; verified by `ariaSnapshot` in e2e.
- Ring: `[data-menu-surface] :is(button, a, [role^='menuitem'], [role='button']):focus-visible` gets
  `outline: 2px solid var(--color-brand-600); outline-offset: -2px`, `.dark` overrides to `--color-brand-400` (D52).
  Contrast: light brand 600 `#0284c7` against white 4.10, slate 100 3.74, brand 100 3.57; dark brand 400 `#8fb3e0`
  against slate 900 7.99, slate 800 7.57, the checked tint 5.6.
- App-wide ring: `:is(button, a, summary, [role='button']):focus-visible` light outline to brand 600 (4.10 on white);
  `.dark` keeps brand 500 `#5b86bf` (4.62 on slate 900).
- Reduced motion: nothing new animates.

## Web Experience

- CLS: zero, as above. INP: a key press is one DOM query and one `focus()`. LCP: untouched; the hooks run only while a
  menu is open.

## Observability

- `console.warn('[menu] opened with no items', { id })` (M1).
- Activations are already logged and counted by each verb's handler; key presses log nothing (spec: no telemetry).

## Testing

| Rule (spec)                                                                                | Test                                                                                      |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Key to intent, wrap, Home/End, typeahead, initial                                          | `packages/ui/src/menu/menu-keys.test.ts`                                                  |
| Own items, ownership chain, tabbable neighbour                                             | `packages/ui/src/menu/menu-dom.test.ts`                                                   |
| Focus in, arrows, activate, Escape, Tab, return                                            | `packages/ui/src/menu/useMenu.test.tsx`                                                   |
| Trigger props, Down / Up open                                                              | `packages/ui/src/menu/useMenuButton.test.tsx`                                             |
| Keyboard-only focus, Escape layering, return                                               | `packages/ui/src/menu/useControlMenu.test.tsx`                                            |
| Rows take the kind's roles                                                                 | `apps/live/components/primitives/PortalMenu.test.tsx`                                     |
| Submenu keys and roles                                                                     | `apps/live/components/primitives/MenuFlyoutSection.test.tsx`, `UseAsDefaultMenu.test.tsx` |
| Canvas stands down inside a menu                                                           | `apps/live/hooks/canvas/useEditorKeyboardShortcuts.dom.test.tsx`                          |
| Folder menu + submenu, element menu, Tab menu, zoom presets, phone drill-down, by keyboard | e2e `apps/live/e2e/menu-keyboard.spec.ts`                                                 |
| Element quick menu kinds                                                                   | `apps/live/components/canvas/ElementEllipsisMenu.test.tsx`                                |
| The tab's Mode as toggle buttons                                                           | `apps/live/components/chrome/TabModeMenuSection.test.tsx`                                 |
| Locked element menu focus and Escape                                                       | `apps/live/components/canvas/LockedElementMenu.test.tsx`                                  |
| Row ⋯ opens on Down / Up Arrow                                                             | `apps/live/components/primitives/useRowMenu.test.tsx`                                     |
| Shape tiles are named                                                                      | `apps/live/lib/element-names.test.ts`                                                     |
| Signed-in account menu by keyboard; a team folder's submenu                                | e2e `apps/live/e2e/clerk-stub/menu-keyboard.spec.ts`, `default-folders-team.spec.ts`      |
| Contrast and optical audits still pass                                                     | e2e `contrast-audit.spec.ts`, `optical-audit.spec.ts`                                     |

## Constants and configuration

| Constant                  | Value                                                                | Provenance                                                        | Safe range |
| ------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------- |
| `MENU_TYPEAHEAD_RESET_MS` | 500                                                                  | D49, the APG examples' buffer                                     | 300–1000   |
| `MENU_FOCUS_RETRY_FRAMES` | 12                                                                   | D60: covers a 150 ms `visibility` transition at 60 Hz with margin | 6–20       |
| `MENU_ITEM_SELECTOR`      | `[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]` | ARIA 1.2                                                          | Fixed      |
| `MENU_SURFACE_ATTR`       | `data-menu-surface`                                                  | This blueprint                                                    | Fixed      |
| `MENU_PARENT_ATTR`        | `data-menu-parent`                                                   | This blueprint                                                    | Fixed      |
| `MENU_LABEL_ATTR`         | `data-menu-label`                                                    | This blueprint                                                    | Fixed      |
| `FOCUSABLE_SELECTOR`      | as `useFocusTrap`, plus `[role^="menuitem"]`, excluding `[inert] *`  | Existing                                                          | Fixed      |

## Assets and external resources

None. No new dependency.
