// Every Sheet function, family by family, with what it takes, what it does and an example
// (docs/specs/029-sheets/sheet.md "Help"). Read from the formula engine's own catalogue, so the article can never
// list a function the Sheet does not have, or miss one. Rendered at build time: no script reaches the page.
import { FUNCTION_DOCS, FUNCTION_FAMILIES } from '@livediagram/sheets';

const anchor = (family: string) => family.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function SheetFunctionList() {
  return (
    <>
      {FUNCTION_FAMILIES.map(([family, fns]) => (
        <section key={family}>
          <h2 id={anchor(family)}>{family}</h2>
          <table>
            <thead>
              <tr>
                <th>Function</th>
                <th>Does</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(fns)
                .sort()
                .map((name) => {
                  const doc = FUNCTION_DOCS[name];
                  return (
                    <tr key={name}>
                      <td>
                        <code>
                          {name}({doc?.args.join(', ') ?? ''})
                        </code>
                      </td>
                      <td>{doc?.summary}</td>
                      <td>{doc ? <code>{doc.example}</code> : null}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
