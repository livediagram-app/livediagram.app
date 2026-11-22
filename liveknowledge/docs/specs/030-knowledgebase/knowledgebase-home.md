# Knowledgebase Home

Status: **built, not yet verified in a browser** ([Build plan](../005-project-roadmap/build-plan.md) step 11). What is
not built is under "Not built" at the foot; the [Home blueprint](blueprints/home.md) has the detail.

`/` for a signed-in person: the start of liveknowledge, in place of the forked start screen. It is the editor app's
root page and `/home` (the address the router sends to the editor; `/` itself is the marketing site's until the
marketing site sends a signed-in person on). Someone not signed in is sent to `/new`, as the start sent everyone.

- **Hero:** "What do you need to know, <first name>?" with the search and Ask field, up to three of the person's
  own recent questions under **Ask Again** (hidden until there are any), and the illustration: the five apps' cubes feeding
  one lime cube, read by a person and an agent. The field searches every knowledgebase the person can open; Ask goes to the
  knowledgebase chosen in its scope chip.
- **Knowledgebases:** a card per knowledgebase the person can open (most recent first, up to 12, then "See All" to the Explorer): name,
  description, page count and the share of pages verified as a bar.
- **Yours to Review:** [Verification](verification.md) "Reminders"; also pages with an agent's suggestion waiting.
  Due is due under each knowledgebase's own Review Period, as its card's verified share is; a period changed in
  this browser shows on the next visit.
- **Recently Updated:** the eight pages changed most recently across those knowledgebases, each with who and when.
- **Start a Knowledgebase From:** three knowledgebase structures, Team Handbook, Engineering Handbook and Support
  Knowledgebase, and **Import** ([Knowledgebase import](../020-import-export/knowledgebase-import.md)). It was
  **Start a Page From** (How-To Guide, Decision Record, Meeting Notes), each tile making a new knowledgebase from one
  page; since the owner's "templates should be entire knowledgebase structures" (2026-11-21,
  [Describe to set up](describe-to-set-up.md#the-start-screen)) a tile that makes a knowledgebase makes a whole one.
- A signed-out visitor sees the marketing site. A person with no knowledgebases sees the hero and one card: **Make Your First
  Knowledgebase**, with Import beside it.
- The numbers come from the index (the list of knowledgebases) and one summary read per knowledgebase (`GET .../summary`: page count,
  verified counts, recent pages), fetched in parallel, at most 12, cached for a minute.

## As built

- **The field** searches as the person types (two characters or more): every knowledgebase shown, each through its
  own search route, all at once, new words ending the requests of the words before. The lists are merged by rank,
  each knowledgebase's best first. A result opens its page. **Ask** (and Enter) goes to the Ask view of the
  knowledgebase in the scope chip ("Ask goes to"), with the question asked there as a new question.
- **The illustration** is one inline SVG drawn in the app: an isometric lime platform with a dashed ring, the five
  other apps as small cubes (sky, violet, amber, rose, emerald, three shades each) joined by dashed lime lines to one
  large lime cube (writing on its left face, a tick on its right), and above it two outlined cards with lime
  shadows, a person's question and an agent's cited answer, each joined to the cube by a dotted curve. One image
  with one label; it follows light and dark.
- **Knowledgebases** cards show the name, "64 pages", "92% verified" and the share as a thin bar. A card keeps its
  height while its numbers are read, and says so when they cannot be.
- **Recently Updated** rows show the page, its knowledgebase and the date.
- **Start a Knowledgebase From** offers **Team Handbook**, **Engineering Handbook** and **Support Knowledgebase**
  (`HOME_STRUCTURES`, `components/home/HomeSections.tsx`), each a `/new?structure=<id>` link that makes a new
  knowledgebase with that structure's whole tree ([New document route](../007-editor/new-document-route.md) "The
  other parameters"), each tile's icon the structure's emblem on its group's colour, as its card on the start draws
  it ([Describe to set up](describe-to-set-up.md#the-start-screen) "A card's picture"), and **Import**, which opens the Import dialog in the scoped knowledgebase (in a new blank one
  for a person with none). Every structure is on the new knowledgebase's start.

## Not built

- **A page from a writing template into a knowledgebase** (How-To Guide, Decision Record, Meeting Notes into a
  knowledgebase Home asks for): not built, so Home offers no single-page template.
- **Yours to Review** is drawn (oldest first, **Still Right**, a link) but has no rows: `GET .../summary` does not
  say which pages the person owns that are due. Pages with an agent's suggestion waiting are not listed either.
- **A card's description** and **who** changed a recently updated page: neither is in the index's list or the
  summary.
- **`/` for a signed-in person** is still the marketing site through the router; Home is at `/home`.
- A search result opens its page, not the passage within it.
