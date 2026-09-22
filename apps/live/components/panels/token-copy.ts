// What revoking an API token (spec/61) says before it happens. One
// string, read by the Tokens pane's popover and the Timeline's
// token-card menu, so the warning can't drift between the two.
export const TOKEN_REVOKE_MESSAGE =
  'Revoke this token? Any script using it stops working immediately.';
