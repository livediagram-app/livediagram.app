// Native `title` is not a hint: it waits on the browser's timer, never shows on keyboard focus or
// touch, cannot be dismissed and ignores dark mode. `iframe` and `abbr` keep it as an accessible
// name (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md).

export const NATIVE_TITLE = {
  selector:
    "JSXOpeningElement[name.name=/^(?!(iframe|abbr)$)[a-z]/] > JSXAttribute[name.name='title']",
  message:
    'Native title is not a hint. Use Tooltip (a name) or HoverCard (a title and description) from @livedesign/ui.',
};
