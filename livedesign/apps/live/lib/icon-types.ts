// The icon catalogue types now live in @livepages/icons (shared with the
// Workers' headless renders); re-exported here so the app's existing
// `@/lib/icon-types` import sites keep resolving unchanged.

export type { IconDef, IconPrim } from '@livepages/icons';
