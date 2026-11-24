# Office files

Status: shipped

livedocuments and liveknowledge both read Word and PowerPoint files into a tab and write a tab out as one
(`livedocuments/docs/specs/020-import-export/office-import.md` and `office-export.md`, and liveknowledge's copies of
them). The parts of that work that know nothing of either product's model live once, in
`@liveworkspace/office-files` (`packages/office-files`). Each editor keeps what is typed on its own model: the walk of
a Word body into its article blocks, the building of a tab, the report, and the building of a deck or a document from
a tab.

## What the package holds

- **Reading a package.** The zip reader (the central directory read once, an entry unpacked only when asked for,
  every byte counted against a cap, so the sizes a file declares are never trusted), the bounded XML reader (no
  document type declaration, depth and element caps, namespaces folded to one prefix each), the opened package (its
  content types, relationships and main part), the named failures and the error the readers throw, every limit by
  name, and the tally of what an import leaves out.
- **Reading a slide.** A slide's shapes as PowerPoint draws them (placeholders, transforms, a text body and how it
  fits), and the size an imported text box needs to show its words.
- **Writing a package.** The Office Open XML package both writers share (content types, relationships, core and
  application properties, then the zip), a CSS colour as Office names one, each face's safe fallback, and how an
  export reports progress and is cancelled.
- **Writing a deck.** What a PowerPoint export writes (`PptxDeck`), a slide's XML and its notes slide's, the fixed
  parts, the theme, and `writePptx`.
- **Fixtures.** A zip writer and small Word, Google Docs, PowerPoint and Google Slides packages built at test time,
  for the package's own tests and each product's.

## What stays in each product

- What a failure says to a person (`officeErrorMessage`): it names the limits of that product's model, and
  liveknowledge speaks of pages where livedocuments speaks of tabs.
- The product's name. A written file names the product that made it (its creator, its application, its theme): the
  product hands it in, as `PptxDeck.app` for a deck and as an argument to `corePropsXml` and `appPropsXml` for a
  Word document. The package never names a product.
- Everything typed on `@livedocuments/document` or `@liveknowledge/document`.

## Rules

- The package imports no product and no React. It depends on `@liveworkspace/model-core` and on
  `@liveworkspace/workbench`'s zip writer.
- It has no barrel: one subpath per module, so an editor's lazy import and export chunks hold only what they name.
- The zip reader serves liveknowledge's knowledgebase import too (`openZipFile`, names as written, its own caps);
  opened with no options it is an Office package's reader, unchanged.
