# Wiki Home

Status: **spec**, not built ([Build plan](../005-project-roadmap/build-plan.md) step 11).

`/` for a signed-in person: the start of liveknowledge, in place of the forked start screen.

- **Hero:** "What do you need to know, <first name>?" with the search and Ask field, three example questions drawn
  from the person's most-read pages (hidden until there are any), and the illustration: the five apps' cubes feeding
  one lime cube, read by a person and an agent. The field searches every wiki the person can open; Ask goes to the
  wiki chosen in its scope chip.
- **Wikis:** a card per wiki the person can open (most recent first, up to 12, then "See All" to the Explorer): name,
  description, page count and the share of pages verified as a bar.
- **Yours to Review:** [Verification](verification.md) "Reminders"; also pages with an agent's suggestion waiting.
- **Recently Updated:** the eight pages changed most recently across those wikis, each with who and when.
- **Start a Page From:** How-To Guide, Decision Record, Meeting Notes, and **Import**
  ([Wiki import](../020-import-export/wiki-import.md)). Each asks which wiki, or makes one.
- A signed-out visitor sees the marketing site. A person with no wikis sees the hero and one card: **Make Your First
  Wiki**, with Import beside it.
- The numbers come from the index (the list of wikis) and one summary read per wiki (`GET .../summary`: page count,
  verified counts, recent pages), fetched in parallel, at most 12, cached for a minute.
