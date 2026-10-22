// Where `/explorer` lands (docs/specs/013-workspace/timeline.md §8.1): Home
// (docs/specs/013-workspace/explorer-home.md). One value for the three places that send a visitor
// there (the live worker's 302, the dev-server fallback page, the e2e stack's stand-in for the
// worker); routes.ts's default and its test keep the route table agreeing with it. Plain TS with no
// imports, so the e2e stack's Node can load it as is.
export const EXPLORER_LANDING_PATH = '/explorer/home';
