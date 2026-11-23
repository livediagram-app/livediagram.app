# Fact sheet

The canonical facts all marketing copy is built from. If something below stops
being true, fix it here first, then propagate to the taglines and descriptions.
Mirrors the site's own words (`apps/marketing/lib/site-words.ts`) and the
marketing FAQ (`apps/marketing/lib/faq-content.tsx`).

## One line

A team knowledgebase, for people and for AI.

## What it is

A place for a team's how-tos, decisions and handbooks, written as pages in a
page tree. Every page has an owner and a verified date, and a review that comes
due. People search it and ask it questions; agents read it through an MCP
server and a command line, with the same access rules and with each page's
trust attached. Part of liveworkspace, beside livediagram, liveplanner,
livedocuments, livedesign and livehuddle.

## Who it's for

- A team that wants its knowledge in one place, linked to each other and to the
  diagrams, plans and designs it talks about.
- A person who wants an answer, with its source, without knowing which page
  holds it.
- A team's agents (a coding agent, a support assistant), which need the same
  knowledge and need to know how far to trust each page.

## What it does

- **Pages in a page tree**, up to 500 pages a knowledgebase and eight levels
  deep, each one continuous page of writing: tables, contents, footnotes,
  margin notes, pictures, charts and drawings in the text, a slash menu and
  live carets.
- **Page links and backlinks**: type `[[` to link to a page; every page lists
  Linked From. Items from the other liveworkspace apps embed live in a page.
- **Verification**: an owner for every page, a Verified tick with who and when,
  one Review Period for the knowledgebase (30, 90, 180 or 365 days, or never)
  and Review Due when it passes. Yours to Review lists what is due, and an owner
  gets one email when pages of theirs come due.
- **Read and edit**: a page opens to read; Edit opens one draft the editors
  share live, and Save publishes it. Pages can have a cover.
- **Describe to Set Up**: describe the knowledgebase and AI proposes its pages.
  Runs on built-in AI when the team has no key, else on the team's key.
- **Search** across a knowledgebase, by keyword, with no key.
- **Ask**: answers from the knowledgebase's own pages with a citation on every
  claim, a Sources rail and a trust line. It says what the pages do not cover
  instead of guessing. Runs on the team's own Claude or OpenAI key.
- **Insights**: which agents read what, questions nobody could answer,
  pages that disagree, edits agents suggest for a person to accept, and Always
  in Context pages.
- **An MCP server and a CLI** that speak in pages and passages. Every passage
  carries its trust: verified or not, when, whether its review is due.
- **Import** a Markdown folder, a Notion export or a Confluence space export.
  **Export** a page to Markdown, PDF and Word.
- **The platform every app shares**: one account, the Explorer, sharing with
  Editor, Participant and Viewer roles, comments, snapshots, Offline, the
  Google Drive mirror and the Community.

## Price and licence

Open source (MIT), and free to start, with every feature on Free. Pro raises a
few limits; don't claim there is no paid tier, and don't lead with Pro. Ask can
run on the team's own AI key, free on every plan, and that usage is paid to its
provider.

## Accounts

Writing needs no account: a guest's knowledgebase is kept Offline in the
browser. Verify, Ask, Insights, sharing and connecting an agent need a free
account.

## Out of scope (never imply these)

- Slides, infographics, flashcards, posters, page layouts, presenting, paper
  sizes, PowerPoint, GIF export. Those are livedocuments'.
- Databases, page-level permissions, semantic search, public sites with their
  own domain, Google Docs import, attachments other than pictures, a native
  mobile app.
- A copy to run on your own servers. It is offered as a hosted service.

## Words

**Knowledgebase** is one word. The product is never called a "wiki" or a
"knowledge base"; "wiki" is only for the category another tool is in. Roles are
Editor, Participant and Viewer. **Offline** names a knowledgebase kept only in
this browser.
