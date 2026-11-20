# Help

Follow the references below only as needed; never upfront.

livedesign's help is the `livedesign` scope of liveworkspace's one help centre, which every app shares:
[One help centre](../../../../liveworkspace/docs/specs/017-help/help-centre.md) and its
[blueprint](../../../../liveworkspace/docs/specs/017-help/blueprints/help-centre.md). Its articles are in
`liveworkspace/apps/help/app`, its edition (header, footer, card art, illustrations, home layout and tests) in
`liveworkspace/apps/help/editions/livedesign`, and its catalogue entries in `packages/help-registry/src/catalogue` (its own
in `livedesign.ts`, the shared ones in `shared/`). How to add one: [Register a help article](../../instructions/register-a-help-article.md).

- ./contextual-help-links.md - when working on Contextual help links: Reusable `HelpArticleLink` deep-linking editor surfaces to their help article; `HELP_ARTICLES` slug source
