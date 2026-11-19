# Callouts blueprint

Derived from [Callouts](../callouts.md).

## Files

| File                                            | Holds                                                          |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `packages/ui/src/callout/Callout.tsx`           | `Callout`, `CalloutTone`, `CalloutSize`, `CALLOUT_TONE`        |
| `packages/ui/src/callout/index.ts`              | The `@liveworkspace/ui/callout` entry                          |
| `packages/ui/src/callout/Callout.test.tsx`      | Tones, sizes, title, action, close, roles, floating            |
| `packages/ui/src/callout/callout-guard.test.ts` | No hand-tinted box outside the allowlist (each entry says why) |

## Interface

```ts
type CalloutTone = 'info' | 'success' | 'warning' | 'error';
type CalloutSize = 'sm' | 'md';
<Callout
  tone="error"            // required
  size="sm"               // default; md for a page or wide pane
  title="Couldn’t save"   // optional, bold above the message
  action={{ label: 'Try Again', onSelect, disabled, reason }} // optional, one text button; `reason`
                          // keeps it focusable, says why in a tooltip and does nothing
  onClose={() => …}       // optional; draws a × labelled "Dismiss"
  floating                // optional: opaque surface and a shadow, for canvas-anchored hints
  role="alert"            // optional; passed through (alert | status | note)
  as="p"                  // div (default) or p, where it sits in a <p>-only spot
  className="mt-3"        // placement only (margin, width, absolute position), never colour or type
>
  message (text, links)
</Callout>
```

`className` carries placement alone: the look is the component's. Icons and inks are the toast's (`TOAST_ICONS`,
`TOAST_ICON_TINT` in `packages/ui/src/toast/ToastCard.tsx`), so the two families share tones.

## Look

| Tone    | Light                                               | Dark                                                       |
| ------- | --------------------------------------------------- | ---------------------------------------------------------- |
| info    | `border-slate-200 bg-slate-50 text-slate-700`       | `border-slate-700 bg-slate-800/60 text-slate-200`          |
| success | `border-emerald-200 bg-emerald-50 text-emerald-800` | `border-emerald-500/30 bg-emerald-500/10 text-emerald-200` |
| warning | `border-amber-200 bg-amber-50 text-amber-900`       | `border-amber-500/30 bg-amber-500/10 text-amber-200`       |
| error   | `border-rose-200 bg-rose-50 text-rose-800`          | `border-rose-500/30 bg-rose-500/10 text-rose-200`          |

- `sm`: `text-xs leading-5 px-2.5 py-1.5 gap-2`, 14px icon. `md`: `text-sm leading-5 px-3 py-2 gap-2.5`, 16px icon.
- Floating: the light surface is already opaque; in dark a solid shade (`slate-900`, `emerald-950`, `amber-950`,
  `rose-950`) replaces the translucent tint, plus `shadow-lg`.
- The action: `font-semibold underline-offset-2 hover:underline` in the tone's ink, a touch target, the focus ring.

## Migration

Each hand-written box (`bg-rose-50`, `bg-red-50`, `bg-amber-50`, `bg-emerald-50` with padding, in a `div` or `p`)
becomes a `Callout` with its tone; red becomes error (rose). `text-[13px]` and `text-sm` boxes in pages and wide panes
take `md`; the rest `sm`. A retry link or button beside the box becomes its `action`. Out-of-scope families
(sign-in, chips, inline field text, buttons, hover tints) are left as they are. `ErrorNote` (settings-ui) becomes a
`Callout tone="error" role="alert"`.

## Tests

| What                                                | Where                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| Tones, sizes, title, action, close, roles, floating | `packages/ui/src/callout/Callout.test.tsx`                               |
| Nothing in view: one line, Show All fits            | `packages/workbench/src/components/canvas/OffscreenContentHint.test.tsx` |
| Every callout is the component (no hand-tinted box) | `packages/ui/src/callout/callout-guard.test.ts`                          |
