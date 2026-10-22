# Scrollbars: blueprint

Derived from [Scrollbars](../scrollbars.md). Defaults applied where the spec is silent are ledgered
in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

| File                                                                | Role                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/tailwind-config/theme.css`                                | The default rule and the `.scrollbar-slim` variant           |
| `packages/tailwind-config/src/scrollbars.test.ts`                   | Guards the rule, its colours and their contrast              |
| `apps/live/components/primitives/MovablePanel.tsx`                  | Loses its inline scrollbar dialect for `.scrollbar-slim`     |
| `apps/help/app/globals.css`, `apps/help/components/SearchInput.tsx` | Lose `.scrollbar-thin` for `.scrollbar-slim`                 |
| `apps/live/e2e/scrollbars.spec.ts`                                  | No scrolling surface in the editor is left on the OS default |

## Domain and naming

| Term             | Identifier        | Meaning                                             |
| ---------------- | ----------------- | --------------------------------------------------- |
| Themed scrollbar | (the default)     | What every scrolling element draws, without a class |
| Slim variant     | `.scrollbar-slim` | The narrower bar for dense strips                   |

Banned: `.scrollbar-thin` and any other per-app scrollbar class; inline `[&::-webkit-scrollbar...]`
arbitrary variants (except `:hidden`, the per-surface hide).

## The rule

In `@layer base` of `theme.css`, so every utility (and every per-surface `scrollbar-width: none`)
outranks it:

```css
@layer base {
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--color-slate-500) transparent;
  }
  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  ::-webkit-scrollbar-track,
  ::-webkit-scrollbar-corner {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background-color: var(--color-slate-500);
    border-radius: 9999px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  ::-webkit-scrollbar-thumb:hover {
    background-color: var(--color-slate-600);
  }
  .dark ::-webkit-scrollbar-thumb:hover {
    background-color: var(--color-slate-400);
  }
}
```

- Standard properties (`scrollbar-width`, `scrollbar-color`) paint the bar in Firefox and Chromium
  121+; where they are set, Chromium ignores the `::-webkit-scrollbar` rules, which therefore paint
  only in Safari (D33).
- The dark palette overrides no `slate-500`, so the dark thumb is the shared slate 500; the
  surfaces it sits on are the dark palette's slate 800 to 950.
- `scrollbar-color` has no hover state; the hover colour exists only in the webkit fallback (D34).
- `.scrollbar-slim`: same colours; `::-webkit-scrollbar` 6 px (the standard `thin` already is the
  narrowest the standard properties allow).

## Testing

| Spec rule                                            | Test                     |
| ---------------------------------------------------- | ------------------------ |
| Default on every element, in the base layer          | `scrollbars.test.ts`     |
| Thumb 3:1 on every surface, both appearances         | `scrollbars.test.ts`     |
| No other scrollbar dialect in the source             | `scrollbars.test.ts`     |
| No scrolling surface on the OS default (dark, light) | `e2e/scrollbars.spec.ts` |

## Constants and configuration

| Constant              | Value     | Provenance                                             | Safe range             |
| --------------------- | --------- | ------------------------------------------------------ | ---------------------- |
| Thumb colour          | slate 500 | WCAG 1.4.11, lowest slate step at 3:1 on every surface | slate 500 to 600 light |
| WebKit width, default | 10 px     | D35, matches Chromium's thin                           | 8 to 12                |
| WebKit width, slim    | 6 px      | The existing slim bar                                  | 4 to 8                 |

## Accessibility

Contrast as computed by the test: slate 500 is 4.76:1 on white, 4.55:1 on slate 50, and 3.45:1 at
worst on the dark surfaces. The bar is never hidden by default and keeps the platform's thin width.
