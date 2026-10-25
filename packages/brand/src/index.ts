// The Living Prism and wordmark every app's logo is (each app's docs/specs/004-interface-design/brand-mark.md):
// one geometry, motion and component, coloured per app. Static drawings (favicons, logo files, the Apple icon,
// the social card) come from ./svg, which needs no React.
export { BRAND_APPS, type BrandApp, type BrandIdentity, type BrandStep } from './apps';
export { Brand, BrandGlyph, BrandMark, type BrandProps } from './Brand';
export { WorkspaceWordmark } from './WorkspaceWordmark';
export * from './svg';
