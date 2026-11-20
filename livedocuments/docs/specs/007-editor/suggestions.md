# Suggestions and tracked changes

Status: retired (owner, 2026-11-17)

Articles no longer take suggestions: suggest mode left every product
([Canvas suggestions](../../../../liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md)). Gone with it: the
page toolbar's Editing and Suggesting menu (with Accept All and Reject All), the suggestion marks and their cards, the
¶ of a suggested paragraph break, Suggest Only and Assistants Suggest in the Share dialog, the Comment button a Suggest
Only Participant had in the margin, `write_article`'s `as: "suggestions"` (and the CLI's `--as`), and the
"suggested N edits" toast. A Participant writes straight in, as the [Share roles](../013-workspace/share-roles.md) say;
an assistant's article write lands as written.

## Writing stored with a suggestion

An article saved while suggestions existed may still hold one (`sg` on a run or a text block). Reading the writing
(`parseArticleFlow`, so the editor, the room, exports and every agent alike) takes it as rejected, the text as it stood
before the suggestion, which is what a Viewer, an export and an agent already read:

- an insertion's words go; a deletion's words stay as plain text;
- a format change puts back the formatting it replaced (its `was`);
- a paragraph break put in joins its block onto the text block before it when the two fit one block (an empty block
  with nothing to join goes); a break taken out leaves both blocks as they are.

The next save writes the writing without them.

A reader that is sent the tab's stored JSON without reading the writing gets the same: a stored tab is settled where
every stored tab is (`migrateStoredTab`, so the api's tab read for a Community visitor, an agent and anyone else, the
offline store and a file import), and a copy of a document settles each tab's stored data before it is copied. The
suggested words, and the name and id of whoever suggested them, never leave storage.

- [x] SG1: a stored tab whose article holds an insertion is read, by a link's visitor and with an agent token, without
      the insertion's words or any `sg`.
- [x] SG2: a copy of a document carries no `sg`.
