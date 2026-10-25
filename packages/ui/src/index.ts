// @liveworkspace/ui: the design system every liveworkspace app shares (docs/structure.md, step 3). Each
// product's own `@<product>/ui` re-exports all of it beside what is that product's alone (its brand, site
// facts, header and footer, chrome icons), so an app imports either. Nothing here knows a product: colour
// comes from the host's Tailwind theme (the `brand-*` ramp), and a spec path in a comment
// (`docs/specs/...`) is each product's own, which share their layout. Tailwind skips node_modules, so an
// app that renders these scans `packages/ui/src` with an `@source` line.
//
// Named exports only, `sideEffects: false`: an app bundles what it uses. The build loaders' kit and the
// relative-time wording also have subpaths (`./build-animation-kit`, `./relative-time`).
export {
  Button,
  ButtonContent,
  buttonClassName,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from './Button';
export {
  FIELD_INVALID,
  TextArea,
  TextInput,
  type TextAreaProps,
  type TextInputProps,
} from './TextInput';
export {
  DATE_YEAR_MIN,
  DateInput,
  dateCommit,
  isWholeDay,
  openDatePicker,
  type DateCommit,
  type DateInputProps,
} from './DateInput';
export { CountBadge } from './CountBadge';
export { EmptyState, EmptyStateArt } from './EmptyState';
export { LoadingSweep } from './LoadingSweep';
export { JsonLd } from './JsonLd';
export { Portal } from './Portal';
export { SheetHandle, SHEET_HANDLE_PX } from './SheetHandle';
export { Tooltip, type TooltipProps } from './Tooltip';
export { HoverCard, type HoverCardProps } from './HoverCard';
export { placeHint, type HintLayout, type HintPlacement } from './hint/place-hint';
export { Dialog, type DialogProps } from './dialog/Dialog';
export { DialogHeader } from './dialog/DialogHeader';
export * from './menu';
export * from './optical';
export { POPOVER_VIEWPORT_MARGIN, clampIntoRange } from './popover';
export { RAIL_CLEAR_PADDING } from './share-rail-clearance';
export { safeInset, atLeastInset, safeInlinePadding } from './safe-area';
export {
  ACTIVE_SEGMENT,
  SEGMENT_TRACK,
  SOLID_BRAND_DARK,
  SOLID_BRAND_DARK_CONTROL,
} from './brand-classes';
export { CONTRIBUTORS } from './contributors';
export { formatRelativeTime, formatRelativeTimeShort, relativeSince } from './relative-time';
export * from './random-uuid-boot';
export { useMediaQuery, PREFERS_REDUCED_MOTION } from './useMediaQuery';
export { useCopiedFlash } from './useCopiedFlash';
export { useClickOutside } from './useClickOutside';
export { useEscape } from './useEscape';
export { useFocusTrap, type FocusTrapInitial } from './useFocusTrap';
export {
  useSheetDrag,
  sheetRelease,
  SHEET_DISMISS_PX,
  SHEET_SNAP_PX,
  SHEET_FULL_HEIGHT,
  type SheetDrag,
} from './useSheetDrag';
export { useVisualViewportBand } from './useVisualViewportBand';
// The base every app's chrome icons are drawn on (icons/Glyph.tsx): the square, stroke-currentColor Glyph, the
// catalogue primitives as SVG children, and lucideGlyph for a vendored Lucide glyph at its default size.
export { Glyph, type IconProps } from './icons/Glyph';
export { lucideGlyph } from './icons/lucide-glyph';
export { Prims } from './icons/Prims';
// The breadcrumb trail every marketing site and help centre draws, and the BreadcrumbList JSON-LD that
// describes it.
export { BreadcrumbTrail, type BreadcrumbItem } from './Breadcrumb';
export { breadcrumbJsonLd, type BreadcrumbCrumb } from './breadcrumb-json-ld';
// The iOS-style switch, and the start screen's "Sync <Kind> to Server" row built on it (save-switch/).
export { Switch } from './Switch';
export * from './save-switch';
