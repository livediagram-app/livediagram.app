// The article registry lives in @livediagram/help-registry (spec/55) so the
// live editor's search panel can consume the same catalogue (spec/09 +
// spec/56). This re-export keeps the help app's historical `@/lib/articles`
// import path stable for the ~120 pages and components that use it; add or
// edit articles in packages/help-registry/src/index.ts.
export * from '@livediagram/help-registry';
