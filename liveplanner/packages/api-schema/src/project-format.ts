// The project format number (docs/specs/016-platform/new-version-prompt.md): the version of the
// stored project shapes. The editor is built with it and the api serves it, from this one
// definition. Bump it only when an older editor can no longer read what the server now serves,
// and with every new card field kind or calculation, or key in a card type's stored shape (project-format.test.ts holds
// the lists).
//   2: packed stroke points (docs/specs/006-project/stroke-points.md).
//   3: card field kinds older editors refuse the catalogue over (docs/specs/026-plan/item-types.md
//      "Fields from a newer version" keeps them read-only from here on):
//      - Image, Person, Labels, Colour, Checklist, Comments and Votes fields (31 Oct 2026).
//      - Percent and Duration fields (31 Oct 2026).
//      - Rollup, Lookup and Formula calculations (31 Oct 2026).
//      - Date and Time, Date Range and Phone fields (1 Nov 2026).
//   4: the Pull Request field (12 Nov 2026; docs/specs/026-plan/github-pull-requests.md).
//   5: the Risk field (12 Nov 2026; docs/specs/026-plan/item-types.md "Risk"), which editors on 4 keep read-only.
//   6: tab icons, a tab's `glyph` and a type's `detailsGlyph` (14 Nov 2026; docs/specs/026-plan/item-types.md "Tab
//      icons"), and unknown card type keys kept through a save ("Settings from a newer version"); editors on 5 drop them.
//   7: a card type's card templates, `templates` (15 Nov 2026; docs/specs/026-plan/item-types.md "Card templates"),
//      which editors on 6 keep through a save only while they fit the 4 KB cap on unknown keys.
//   8: a card type's card prefix, `prefix` (18 Nov 2026; docs/specs/026-plan/item-types.md "Card number prefixes"),
//      which editors on 6 and 7 keep through a save as an unknown key and do not show.
export const PROJECT_FORMAT = 8;

// Every api response carries the server's number in this header.
export const PROJECT_FORMAT_HEADER = 'X-Liveplanner-Format';

// Reading the number off the wire is liveworkspace's.
export { parseDocumentFormat as parseProjectFormat } from '@liveworkspace/api-schema/document-format';
