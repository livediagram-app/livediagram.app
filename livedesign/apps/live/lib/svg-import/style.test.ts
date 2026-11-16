// docs/specs/020-import-export/svg-import.md "Style": `<style>` rules with simple selectors, cascaded by specificity
// and order; declarations of the properties SVG import reads.
import { describe, expect, it } from 'vitest';
import { parseDeclarations, StyleSheet } from './style';

describe('parseDeclarations', () => {
  it('keeps the properties SVG import reads, lower-cased, !important dropped', () => {
    expect(
      parseDeclarations('FILL: red; stroke:blue !important; font-size: 3px; bogus; opacity:'),
    ).toEqual({
      fill: 'red',
      stroke: 'blue',
    });
  });
});

describe('StyleSheet', () => {
  it('matches tags, classes, ids and compounds, the most specific and latest winning', () => {
    const sheet = new StyleSheet();
    sheet.add(`
      /* an Illustrator export */
      path { fill: green; stroke: black }
      .cls-1, .cls-2 { fill: #e30613 }
      path.cls-1 { stroke: blue }
      #logo { fill: gold }
      .cls-1 { opacity: 0.5 }
    `);
    expect(sheet.match('path', null, [])).toEqual({ fill: 'green', stroke: 'black' });
    expect(sheet.match('path', null, ['cls-1'])).toEqual({
      fill: '#e30613',
      stroke: 'blue',
      opacity: '0.5',
    });
    expect(sheet.match('rect', null, ['cls-2'])).toEqual({ fill: '#e30613' });
    expect(sheet.match('path', 'logo', ['cls-1']).fill).toBe('gold');
    expect(sheet.match('circle', null, [])).toEqual({});
  });

  it('ignores at-rules, complex selectors, empty bodies and an unclosed comment', () => {
    const sheet = new StyleSheet();
    sheet.add(`@media print { path { fill: red } } g path { fill: blue } a:hover { fill: pink }
      [x] { fill: pink } .a .b { fill: pink } #a#b { fill: pink } . { fill: pink } path { font: x }
      #a.b { fill: teal } rect {fill: navy} /* unclosed`);
    expect(sheet.match('path', null, [])).toEqual({});
    expect(sheet.match('rect', null, [])).toEqual({ fill: 'navy' });
    expect(sheet.match('path', 'a', ['b'])).toEqual({ fill: 'teal' });
    expect(sheet.match('path', 'a', [])).toEqual({});
    const unclosed = new StyleSheet();
    unclosed.add('path { fill: red');
    expect(unclosed.match('path', null, [])).toEqual({ fill: 'red' });
  });

  it('answers nothing from an empty sheet', () => {
    expect(new StyleSheet().match('path', 'x', ['y'])).toEqual({});
  });
});
