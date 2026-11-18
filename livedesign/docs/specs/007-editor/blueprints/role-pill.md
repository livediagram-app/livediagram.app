# Role pill: blueprint

Derived from the [role pill](../live-app.md#role-pill) in Live app. Hints follow
[Tooltips, hover cards and popovers](../../004-interface-design/tooltips-hover-cards-popovers.md). The spec decides; this
file only adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`. (This blueprint was the Power user mode blueprint until that mode was
retired, [Power user mode](../power-user-mode.md); the role pill is what remains of it.)

Scope, by file:

| File                                                                         | Role                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/live/components/chrome/RoleIndicator.tsx`                              | `RolePill` (title bar)                                                    |
| `apps/live/app/design/[id]/useViewPreview.ts`                                | `viewPreview`, `canToggleRole`, `toggleViewPreview`                       |
| `apps/live/app/design/[id]/useRoleIndicator.ts`                              | Role in force, owner name and toggle, for the pill                        |
| `apps/live/app/design/[id]/useEditorState.ts`                                | `isReadOnly` includes the preview                                         |
| `apps/live/app/design/[id]/editor-view-bars.tsx`                             | Hands the Editing Mode button its wiring (`editingMode`) through `TabBar` |
| `apps/live/components/chrome/ChromeControls.tsx`                             | Draws `EditingModeButton` between Tools and Settings                      |
| `packages/workbench/src/components/chrome/EditingModeButton.tsx` (repo root) | `EditingModeButton`, the shared button                                    |
| `packages/workbench/src/lib/editing-mode.ts` (repo root)                     | `editingModes`, `nextEditingMode`: the modes and their order              |
| `apps/live/components/chrome/EditorHeader.tsx`                               | `rolePill` slot after the visibility badge                                |
| `apps/live/components/chrome/TopCenterChrome.tsx`                            | No separate visitor owner / role badge                                    |

## Domain and naming

| Term         | Identifier                                            | Meaning                                                 |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------- |
| Role pill    | `RolePill`                                            | Title-bar pill: Editing / Viewing, owner in its Tooltip |
| View preview | `viewPreview`, `toggleViewPreview` (`useViewPreview`) | Local read-only preview for someone who may edit        |

Banned: "badge" for the role pill.

## Behaviour and state

- `viewPreview: boolean` in `useEditorState`, initial `false`, never persisted (spec: a reload returns to Editing).
- `isReadOnly = sessionRole === 'view' || viewPreview`; everything downstream (`isStructureReadOnly`, `editsBlocked`,
  the palette, the toolbars) already follows `isReadOnly`.
- `canToggleRole = sessionRole === 'edit'`: true for the owner and for an edit-link visitor alike, false for a
  view-link visitor. `toggleViewPreview()` flips it and deselects (a selection toolbar for an
  edit session must not linger into view mode, D7).
- `sessionRole` itself is untouched: presence still reports the real role, so peers see no change.

`RolePill` props: `{ role: 'edit' | 'view'; ownerName: string | null; isSelf: boolean; onToggle?: () => void }`,
where `role` is the role in force (`isReadOnly ? 'view' : 'edit'`).

- Tooltip label `ownerName ? (isSelf ? 'Owned by you' : \`Owned by ${ownerName}\`) : ''`.
- With `onToggle`: a `<button>` with visible text, `aria-label` = `${Editing|Viewing}. ${tooltip}` (or just the role
  word without an owner), `aria-describedby` a visually hidden hint "Switch to viewing (read-only)" / "Switch to
  editing".
- Without: a `<span tabIndex={0}>` with the visible role word and the owner phrase as visually hidden text.

## Editing Mode button

Work Tracker 1291: the role pill's switch is the **Editing Mode button** in the tab bar, between Tools and Settings
(the spec's "Role pill"; the shared rules in
[footer-tools-menu blueprint](../../../../../liveworkspace/docs/specs/004-index/blueprints/footer-tools-menu.md) FM-EM).

- `useViewPreview` returns `previewModes = editingModes(sessionRole, PREVIEW_MODES)`: the app's offered modes from the
  session's role down. `setViewPreview(level)` takes any of them (a level outside them is ignored), and the level in
  force is the preview while it is one of them, else the session's role. `canToggleRole` keeps meaning "an Editor's
  session" (the Participant preview's own adder key follows it); a Participant previewing as a Viewer keeps the room's
  key and simply reads.
- The bars pass `editingMode = { mode: can.level, modes: previewModes, noun, owner: roleOwnerLabel(...), onPick:
setViewPreview }`, and `ChromeControls` draws `<EditingModeButton {...editingMode} labelled={labelled} />` straight
  after `ChromeToolsMenu`. With one mode the button renders nothing.
- `RolePill` is no longer mounted (the title bar went with the header experiment); `roleOwnerLabel` stays as the owner
  line's one source.

## Errors and edge cases

| Case                                    | Behaviour                                                 |
| --------------------------------------- | --------------------------------------------------------- |
| View preview while text is being edited | Toggle deselects first, which commits / closes the editor |

## Security and trust

- View preview is presentation only: it narrows what this client offers and never widens anything. The api still
  enforces the real role on every write.

## Presentation and UX

- Role pill: `rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider`, the visibility badge's
  shape; emerald for Editing, amber for Viewing; a toggle pill adds a hover ring and `cursor-pointer`.

## Accessibility

- Role pill: WCAG 2.5.3 label-in-name holds (the accessible name starts with the visible word); 4.1.2 via button
  semantics and `aria-describedby`. Contrast: emerald 800 on emerald 100 and amber 800 on amber 100 (both above 4.5:1),
  and their dark counterparts.

## Observability

| Decision             | Log                                       |
| -------------------- | ----------------------------------------- |
| View preview flipped | `console.info('[role] view preview', on)` |

## Testing

| Rule                                                                 | Test                                                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Toggle for owner and edit link, none for view link                   | `app/design/[id]/useViewPreview.test.tsx` (jsdom)                                                                        |
| Role pill: toggle vs static, names, Tooltip label                    | `components/chrome/RoleIndicator.test.tsx` (jsdom)                                                                       |
| The button: modes, order, wrap, names, hover card, none for one mode | `packages/workbench/src/components/chrome/EditingModeButton.test.tsx`, `packages/workbench/src/lib/editing-mode.test.ts` |
| A Participant previews as a Viewer and back                          | `app/design/[id]/useViewPreview.test.tsx` (jsdom)                                                                        |
| The Editing Mode button steps the owner through the modes            | `e2e/role-pill.spec.ts`                                                                                                  |
| A blob with the retired power user keys loads                        | `e2e/role-pill.spec.ts`, `packages/api-schema/src/legacy-preferences.test.ts`                                            |

## Defaults ledger

D7 in [DEFAULTS.md](DEFAULTS.md).
