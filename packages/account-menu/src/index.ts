// The account control, one for liveworkspace.app and every app, signed in or as Guest (liveworkspace/docs/site.md
// "The header").
export {
  ACCOUNT_PAGES,
  AccountMenu,
  type AccountMenuButton,
  type AccountMenuKit,
  type GuestAccount,
} from './AccountMenu';
export { AppAccountMenu } from './AppAccountMenu';
export {
  appAccountOf,
  appSignInHref,
  appSignOut,
  appSignUpHref,
  pageHere,
  useAppAccount,
  workspacePageHref,
  type AppAccount,
} from './app-account';
export { initials } from './initials';
export type { DeferredMenuProps } from './placeholder';
