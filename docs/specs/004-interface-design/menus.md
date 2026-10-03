# Menus

Status: shipped

## What

Every floating list of actions or settings that opens from a control, a right-click, a long press or
Shift+F10 is a **menu** to the person using it. To assistive technology a menu is announced by what
it holds, and every menu behaves the same way from the keyboard. This meets WCAG 2.2 AA and follows
the WAI-ARIA Authoring Practices [Menu and Menubar](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
and [Menu Button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) patterns.

## Two kinds of menu

| Kind             | Holds                                                                                   | Announced as              |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------- |
| **Command menu** | Only verbs and choices: rows, tiles, tool buttons, checkable entries, submenus of these | `menu` of menu items      |
| **Control menu** | Anything more: a slider, a text field, a select, a swatch row, a dial, a sub-panel      | Non-modal `dialog`, named |

A menu holding even one control is a control menu: ARIA lets a `menu` own nothing but menu items,
groups and separators, so a slider inside one is invisible or garbled to a screen reader. The words
"menu", "context menu" and "tab menu" stay in copy for both kinds; the kind is how they are built.

## Command menus

### Semantics

- The menu is `role="menu"`, named by its header when it has one (`aria-labelledby`), otherwise by
  its trigger's name.
- A verb is `menuitem`; an on/off entry is `menuitemcheckbox` and a one-of-a-set entry is
  `menuitemradio`, each with `aria-checked`.
- An entry that exists but cannot run now stays in the menu, focusable, with `aria-disabled="true"`;
  activating it does nothing.
- A group's title (an accordion header inside a menu) is a `menuitem` with `aria-expanded`, and the
  rows it reveals are a `group` labelled by it. Collapsed rows are inert: not focusable, not read.
- A divider is a `separator`. A header naming the menu is not an item and is never focused.
- A submenu's trigger is a `menuitem` with `aria-haspopup="menu"`, `aria-expanded` and, while open,
  `aria-controls`; the submenu is a `menu` named by its header or its trigger.
- A menu's trigger carries `aria-haspopup="menu"`, `aria-expanded` and, while open, `aria-controls`
  naming the menu.

### Keyboard

There is one Tab stop: focus lives on one item at a time and the arrow keys move it.

| Key                      | Does                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Enter, Space, Down Arrow | On the trigger: open the menu, focus on its first item (the checked one in a one-of-a-set menu)       |
| Up Arrow                 | On the trigger: open the menu, focus on its last item                                                 |
| Down Arrow / Up Arrow    | Next / previous item, wrapping at the ends                                                            |
| Home / End               | First / last item                                                                                     |
| A letter or digit        | Next item whose name starts with what was typed in the last half second; one letter again cycles them |
| Enter, Space             | Activate the item (a submenu trigger opens its submenu and focuses its first item)                    |
| Right Arrow              | On a submenu trigger: open the submenu and focus its first item                                       |
| Left Arrow               | In a submenu: close it and focus its trigger                                                          |
| Escape                   | Close the menu holding focus (only the submenu, when in one) and return focus to what opened it       |
| Tab, Shift+Tab           | Close the whole menu and move to the control after (before) where focus was when it opened            |

- **Focus moves into the menu on open**, however it was opened: to the checked entry of a
  one-of-a-set menu, else the first item. A menu opened by hovering (the zoom presets) is the one
  exception: hover is not asking for the keyboard, so focus stays where it was.
- **Focus comes back.** When a menu closes while it holds focus (Escape, choosing a verb) focus
  returns to where it was when the menu opened: the trigger that opened it, the tree row Shift+F10
  was pressed on, the element that was right-clicked. If that place is gone, or was nowhere, it
  goes to the menu's trigger. A verb that opens a dialog or a rename field hands focus on from there.
- **The zoom percentage is a button of its own**: Enter and Space fit the screen, as a click does,
  and Down Arrow or Up Arrow opens its presets.
- Opening never takes focus from a live text edit: a menu opened beside a label being edited
  leaves the caret where it is.
- While focus is inside a menu of either kind the canvas's shortcuts stand down: an arrow in a menu
  never nudges the selection, and Delete, Escape or Tab in one never deletes, deselects or grows
  the diagram.

## Control menus

- The menu is a non-modal `role="dialog"` with a name ("Element menu", "Selection menu", "Cell
  menu", "Tab menu", "Canvas menu", "Layer menu", the session tool's settings, "Live image").
- Its controls keep their own roles: buttons, toggle buttons (`aria-pressed`), sliders, fields,
  selects. Its accordion headers are disclosure buttons (`aria-expanded`) and collapsed sections are
  inert. Its flyouts are triggered by a button with `aria-haspopup="dialog"` and `aria-expanded`,
  and are themselves named non-modal dialogs.
- **Keyboard**: Tab and Shift+Tab walk its controls in reading order. Focus moves to its first
  control when it was opened from the keyboard (Shift+F10, the Menu key, Enter on a trigger); opened
  by pointer it stays beside the canvas without taking focus, as it always has, so a right-click
  followed by Delete still deletes. Escape closes the innermost open flyout first, then the menu,
  and focus returns as for a command menu. Focus is not trapped: Tab past the last control leaves
  it, and it stays open, because it is a companion to the canvas.
- Opening a flyout from the keyboard moves focus to its first control; Escape in the flyout closes
  only the flyout and returns focus to its trigger.

## Focus ring

Every item and control in either kind of menu shows the keyboard focus ring **inside** its own edge
(a 2px outline, inset 2px), so a full-width row in a clipped menu never loses half its ring. It is
brand 600 in light (3.57:1 or more against every row tone: white, the hover slate 100, the checked
brand 100) and brand 400 in dark (5.6:1 or more against slate 900, slate 800 and the checked tint),
meeting WCAG 1.4.11's 3:1. Pointer focus never shows it (`:focus-visible`).

The app-wide ring outside menus moves from brand 500 to brand 600 in light for the same reason:
brand 500 on white is 2.77:1. Dark keeps brand 500 (4.4:1 or more on the dark surfaces).

## Pointer behaviour is unchanged

Click, right-click, long press, hover-open (the zoom presets), outside-press dismissal, the
bottom sheet on a phone, menu-follows-selection on the canvas and
[flyout height stability](./flyout-height-stability.md) behave exactly as before. Roles, focus and
keys add nothing to a menu's box: no row grows, moves or appears when focus arrives.

## The menus

Each menu, how it opens, what it holds, and what the keyboard could do before this spec.

### Command menus

| Menu                  | Opens from                                                     | Holds                                                                    | Keyboard before                                     |
| --------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| Document menu         | ⋯ on an Explorer row, card or tree row; right-click; Shift+F10 | Name header, verbs, Delete or Dismiss under a separator                  | Tab only; no Escape; buttons in a `menu`            |
| Folder menu           | Same, on a folder; My documents in the sidebar and panel       | Name header, verbs, **Use as default for** ▸ (checkable entries), Delete | Tab only; submenu unreachable by arrows             |
| Timeline card menu    | ⋯ on a Timeline card                                           | Verbs                                                                    | Tab only                                            |
| Explorer More menu    | More in the Explorer panel header                              | Verbs in bands                                                           | Tab only                                            |
| New menus             | + in the Explorer pane header and a team library header        | Document, Folder tiles                                                   | Tab only                                            |
| Team menu             | ⋯ on a team in the Teams pane                                  | Tiles                                                                    | Tab only                                            |
| Slide menu            | ⋯ on a presentation slide row                                  | Tool buttons, accordion groups of tiles                                  | Tab only, into collapsed rows too                   |
| Embed copy menu       | Embed on a share pass                                          | Copy rows                                                                | Tab only                                            |
| Selection filter menu | The filter button on a mixed selection                         | One tile per element type                                                | Tab only                                            |
| Custom colour menu    | Right-click, long press or Shift+F10 on a custom Draw colour   | Remove                                                                   | Focus in, Escape                                    |
| Editor mode menu      | The mode chip                                                  | One-of-a-set modes                                                       | Arrows, Home, End, Escape; no typeahead, Tab        |
| Zoom menu             | Hovering or focusing the zoom percentage                       | One-of-a-set zoom levels, Fit to screen                                  | Opened on focus; Tab through; no arrows             |
| Account menu          | The account pill                                               | Name header, Account, Sign out                                           | Tab only; trigger had no `aria-haspopup`; no Escape |
| Embed tab menu        | The tab pill on an embedded document                           | One-of-a-set tabs                                                        | Tab, Escape                                         |
| Element quick menus   | ⋯ on a Q&A board, Done check, Idea box, Quiz                   | Verbs, one-of-a-set choices, labelled groups, All settings…              | Tab only                                            |
| Locked element menu   | Right-click on an element someone else holds                   | "In use" header, Release rows, a note                                    | Escape only                                         |
| Product switcher      | The section name in the help, telemetry and marketing headers  | Section links                                                            | Tab only                                            |
| Telemetry view picker | The view button on the sticky window bar                       | Views                                                                    | Tab only                                            |

### Control menus

| Menu                  | Opens from                                                               | Holds                                                                    |
| --------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Element menu          | Right-click, long press or Shift+F10 on an element; an element's ⋯       | Accordions, tiles, sliders, colour rows, fields, flyouts, Session Studio |
| Selection menu        | The same on a multi-selection                                            | Accordions, tiles, sliders, colour rows, flyouts                         |
| Cell menu             | Right-click on a table cell                                              | Text toggles, colour rows, tiles                                         |
| Tab menu, Canvas menu | ⋯ on the active tab; right-click on the canvas; the footer canvas button | Tool buttons, accordions, Opens in, canvas sections, Collaborate flyout  |
| Layer menu            | ⋯ on a layer row                                                         | Tool buttons, an opacity slider, accordion tiles                         |
| Session tool settings | ⋯ on a timer, stopwatch, vote or poll element                            | The Session Studio pane for that tool                                    |
| Live image copy menu  | Live image on a share pass, with more than one tab                       | A tab select, copy rows                                                  |

Before this spec every one of them was `role="menu"`, so their sliders, fields and toggles sat inside
a menu that may not own them, and opening one from the keyboard left focus behind.

### Not menus

Listbox dropdowns (the palette and canvas-tool pickers, the rich-text toolbar's dropdowns, the
Explorer filter chips), dialog popovers (Settings, presence, infographic pages), mention suggestions
and toolbars follow their own patterns and are out of scope.

## Telemetry

None. Menus already count the verbs chosen in them; how focus moved is not an action.

## Where it lives

- `@livediagram/ui` owns the keyboard model and the hooks every app's menus use (`useMenu`,
  `useMenuButton`, `useControlMenu`), so the editor, help, telemetry and marketing menus behave as
  one.
- The editor's menu primitives (`PortalMenu`, `ContextMenu`, `MenuFlyoutSection` and the row
  components) pick each row's role from the kind of menu they sit in.
- The focus ring rules live in the shared Tailwind theme.
