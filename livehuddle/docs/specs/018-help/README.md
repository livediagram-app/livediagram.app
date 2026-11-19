# Help

Follow the references below only as needed; never upfront.

livehuddle's help is the `livehuddle` scope of liveworkspace's one help centre, which every app shares:
[One help centre](../../../../liveworkspace/docs/specs/016-help/help-centre.md) and its
[blueprint](../../../../liveworkspace/docs/specs/016-help/blueprints/help-centre.md). Its articles are in
`liveworkspace/apps/help/app`, its edition (header, footer, card art, illustrations, home layout and tests) in
`liveworkspace/apps/help/editions/livehuddle`, and its catalogue entries in `packages/help-registry/src/catalogue` (its own
in `livehuddle.ts`, the shared ones in `shared/`). How to add one: [Register a help article](../../instructions/register-a-help-article.md).

- ./contextual-help-links.md - when working on Contextual help links: Reusable `HelpArticleLink` deep-linking editor surfaces to their help article; `HELP_ARTICLES` slug source
