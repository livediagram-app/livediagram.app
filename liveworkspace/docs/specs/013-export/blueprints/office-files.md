# Office files: blueprint

Derived from [Office files](../office-files.md). The spec decides; this file only adds engineering precision.

## Domain and naming

`@liveworkspace/office-files` (`packages/office-files`), `exports` `./*` to `./src/*.ts`, no barrel, `sideEffects:
false`. Dependencies: `@liveworkspace/model-core` (`basics`, `css-colour`; `fonts` in a test) and
`@liveworkspace/workbench` (`lib/zip-writer`). Used by `@livedocuments/editor` and `@liveknowledge/editor`, under
their `lib/office-import/`, `lib/office-export/` and, in liveknowledge, `lib/knowledge-import/`.

| File (`packages/office-files/src/`)  | Holds                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `limits.ts`                          | Every number an import uses, named; OOXML's units (`EMU_PER_PX`, `EMU_PER_PT`)            |
| `errors.ts`                          | `FileImportFormat`, `OfficeImportFailure`, `OfficeImportError` (`failure`, `count`)       |
| `zip.ts`                             | `openZip`, `openZipFile`, `ZipOptions`, `ZipArchive`, `zipKey`, `inflateCapped`           |
| `xml.ts`                             | `parseXml` and the tree readers over `XmlElement`                                         |
| `package.ts`                         | `openOfficePackage`, `OfficePackage`, `OfficeRel`, `resolvePartPath`                      |
| `tally.ts`                           | `SKIP_KINDS`, `SkipTally`, `addSkip`                                                      |
| `pptx-shapes.ts`                     | A slide's placeholders, transforms and text bodies as items; `bodyFitOf`                  |
| `text-fit.ts`                        | `fitTextBox`: a no-wrap box widened, an autofit box grown to its text (estimated, linear) |
| `ooxml.ts`                           | `writeOoxmlPackage`, `relsXml`, `corePropsXml(title, when, app)`, `appPropsXml(app)`      |
| `ooxml-colour.ts`                    | `ooxmlColour`, `NO_PAINT`, `fontFaceName`                                                 |
| `ooxml-fonts.ts`                     | `officeFace`, `fontTableXml`, `pitchFamilyOf`                                             |
| `ooxml-theme.ts`                     | `themeFontsOf`, `themeXml(fonts, name)`                                                   |
| `pptx-types.ts`                      | `PptxDeck` (`title`, `app`, `cx`, `cy`, `slides`) and what a slide holds                  |
| `pptx-slide-xml.ts`, `pptx-parts.ts` | A slide's and its notes' XML; the presentation, master, layout, notes master, properties  |
| `pptx-write.ts`                      | `writePptx(deck, when)`, `MediaStore`, `PPTX_MIME`                                        |
| `progress.ts`                        | `ExportProgress`, `ExportCancelled`, `throwIfCancelled`, `yieldToBrowser`                 |
| `test-fixtures.ts`                   | `makeZip`, `makeDocx`, `makePptx` and the sample packages, for tests only                 |

## Interfaces and contracts

- The product's name reaches a written file three ways, all escaped with `xmlText`: `corePropsXml`'s `app` is
  `dc:creator`; `appPropsXml`'s `app` is `Application`; `themeXml`'s `name` names the theme and its colour, font and
  format schemes. `writePptx` passes `deck.app` to all three; each product's `buildDeck` sets `app` to its own name,
  and its `writeDocx` passes its name to the first two.
- `OfficeImportError` carries a failure and, where a message names a number, a count. The package never words a
  failure: each product's `apps/editor/lib/office-import/errors.ts` does (`officeErrorMessage`).
- `openZip(bytes)` and `openZipFile(blob)` take `ZipOptions` (`names`, `maxEntries`, `maxUnpackedBytes`); absent, the
  names are folded and the caps are `OFFICE_MAX_ZIP_ENTRIES` and `OFFICE_MAX_UNPACKED_BYTES`.

## Security and trust

The files are untrusted. The readers' bounds are the products' own, stated in
`livedocuments/docs/specs/020-import-export/blueprints/office-import.md` "Untrusted files" and unchanged by the move:
no DTD, the XML depth and element caps, the zip entry cap, every unpacked byte counted against a cap as it arrives.

## Performance and limits

Nothing here runs on a render or pointer path: an import or an export is one lazy chunk a person asks for. The
modules are imported by subpath, so each editor's chunks hold what they held before the move. `text-fit.test.ts`
holds `fitTextBox` to a CPU budget (`cpuMsOf`).

## Testing

`xml.test.ts`, `zip.test.ts`, `package.test.ts`, `pptx-shapes.test.ts`, `text-fit.test.ts` and `ooxml-fonts.test.ts`
run in the package (Node). The PowerPoint writer is tested where a deck is built from a tab: each product's
`apps/editor/lib/office-export/pptx.test.ts` and `office-export.perf.test.ts`; the readers again through each
product's `apps/editor/lib/office-import/` tests, which build their files with `test-fixtures.ts`.
