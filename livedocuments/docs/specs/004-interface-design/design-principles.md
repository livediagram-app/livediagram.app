# Design principles

- **Calm by default**: we make it a great experience without overloading the user; name only what people need to find, and let order, layout and familiar patterns carry the rest.
- **A button always says it can be pressed**: every enabled button, and anything with `role="button"`, shows the pointer cursor on hover, in every app. The rule lives once in the shared theme (`packages/tailwind-config/theme.css`, base layer), so no control has to remember it; a disabled one keeps the default arrow.
