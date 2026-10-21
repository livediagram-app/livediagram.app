// The article registry lives in @livediagram/help-registry (docs/specs/018-help/help-app.md) so the
// live editor's search panel can consume the same catalogue (docs/specs/008-canvas/canvas-and-palette.md +
// docs/specs/018-help/contextual-help-links.md). This re-export keeps the help app's historical `@/lib/articles`
// import path stable for the ~120 pages and components that use it; add or
// edit articles in packages/help-registry/src/index.ts.
export * from '@livediagram/help-registry';
