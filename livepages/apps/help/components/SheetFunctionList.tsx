// Every Sheet function, family by family, with what it takes, what it does and an example
// (docs/specs/029-sheets/sheet.md "Help"). Read from the formula engine's own catalogue, so the article can never
// list a function the Sheet does not have, or miss one. Rendered at build time: no script reaches the page. Drawn
// with the article's own heading, table and code pieces (raw tags skip the MDX map: an unstyled table that ran off a
// phone's edge, its Example column out of reach).
import { FUNCTION_DOCS, FUNCTION_FAMILIES } from '@livepages/sheets';
import { InlineCode, SectionHeading, Table, Td, Th } from '@/mdx-components';

export function SheetFunctionList() {
  return (
    <>
      {FUNCTION_FAMILIES.map(([family, fns]) => (
        <section key={family}>
          <SectionHeading>{family}</SectionHeading>
          <Table>
            <thead>
              <tr>
                <Th>Function</Th>
                <Th>Does</Th>
                <Th>Example</Th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(fns)
                .sort()
                .map((name) => {
                  const doc = FUNCTION_DOCS[name];
                  return (
                    <tr key={name}>
                      <Td>
                        <InlineCode>
                          {name}({doc?.args.join(', ') ?? ''})
                        </InlineCode>
                      </Td>
                      <Td>{doc?.summary}</Td>
                      <Td>{doc ? <InlineCode>{doc.example}</InlineCode> : null}</Td>
                    </tr>
                  );
                })}
            </tbody>
          </Table>
        </section>
      ))}
    </>
  );
}
