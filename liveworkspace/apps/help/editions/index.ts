// The build's edition (types.ts): the scope's header, footer, art, home layout and ui facts. The pick is
// current.generated.ts, which scripts/build-scopes.mjs writes for each scope, so a build imports only its own
// edition (and its own product ui), never the other five.
export { EDITION } from './current.generated';
export type { AppEdition, Edition, EditionUiFacts } from './types';
