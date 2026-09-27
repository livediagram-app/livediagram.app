// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { absoluteRect, originOf, readGraph } from './cells';
import { model, vertex } from './test-support';

describe('readGraph', () => {
  it('reads cells, the root and its layers', () => {
    const g = readGraph(
      model(
        `${vertex('a', 'rounded=1;', 'x="10" y="20" width="30" height="40"', 'value="A" parent="1"')}` +
          '<mxCell id="L2" value="Notes" parent="0" visible="0" style="locked=1;"/>',
      ),
    );
    expect(g.rootId).toBe('0');
    expect(g.layerIds).toEqual(['1', 'L2']);
    const a = g.cells.get('a')!;
    expect(a).toMatchObject({ vertex: true, edge: false, value: 'A', parentId: '1' });
    expect(a.geometry).toMatchObject({ x: 10, y: 20, width: 30, height: 40, relative: false });
    expect(g.cells.get('L2')!.visible).toBe(false);
    expect(g.cells.get('1')!.children).toEqual(['a']);
  });

  it('reads the page background', () => {
    expect(readGraph(model('', 'background="#FAFAF5"')).background).toBe('#fafaf5');
    expect(readGraph(model('', 'background="none"')).background).toBeUndefined();
    expect(readGraph(model('', 'backgroundImage="{}"')).backgroundImage).toBe(true);
  });

  it('unwraps UserObject and object, keeping label, link, tooltip and properties', () => {
    const g = readGraph(
      model(
        '<UserObject label="%owner%&apos;s %missing%" owner="Ops" tier="1" link="https://x.test" tooltip="Hi" placeholders="1" id="u">' +
          '<mxCell style="" vertex="1" parent="1"><mxGeometry width="10" height="10" as="geometry"/></mxCell></UserObject>' +
          '<object label="Obj" id="o"><mxCell vertex="1" parent="1"><mxGeometry width="1" height="1" as="geometry"/></mxCell></object>',
      ),
    );
    const u = g.cells.get('u')!;
    expect(u.value).toBe("Ops's %missing%");
    expect(u.link).toBe('https://x.test');
    expect(u.tooltip).toBe('Hi');
    expect(u.props).toEqual([
      ['owner', 'Ops'],
      ['tier', '1'],
    ]);
    expect(g.cells.get('o')!.value).toBe('Obj');
  });

  it('reads edges, their ends, waypoints and loose points', () => {
    const g = readGraph(
      model(
        '<mxCell id="e" edge="1" parent="1" source="a" target="b" style="curved=1;"><mxGeometry relative="1" as="geometry">' +
          '<mxPoint x="1" y="2" as="sourcePoint"/><mxPoint x="3" y="4" as="targetPoint"/>' +
          '<Array as="points"><mxPoint x="5" y="6"/><mxPoint x="7"/></Array></mxGeometry></mxCell>',
      ),
    );
    const e = g.cells.get('e')!;
    expect(e).toMatchObject({ edge: true, source: 'a', target: 'b' });
    expect(e.style.flag('curved')).toBe(true);
    expect(e.geometry).toMatchObject({
      sourcePoint: { x: 1, y: 2 },
      targetPoint: { x: 3, y: 4 },
      points: [
        { x: 5, y: 6 },
        { x: 7, y: 0 },
      ],
    });
  });

  it('marks html labels and collapsed cells', () => {
    const g = readGraph(
      model(vertex('c', 'html=1;', 'width="1" height="1"', 'parent="1" collapsed="1"')),
    );
    expect(g.cells.get('c')).toMatchObject({ html: true, collapsed: true });
  });

  it('adopts a cell whose parent is missing into the first layer', () => {
    const g = readGraph(model(vertex('x', '', 'width="1" height="1"', 'parent="ghost"')));
    expect(g.cells.get('x')!.parentId).toBe('1');
    expect(g.cells.get('1')!.children).toContain('x');
  });

  it('treats non-finite geometry as zero', () => {
    const g = readGraph(model(vertex('n', '', 'x="abc" width="5" height="5"', 'parent="1"')));
    expect(g.cells.get('n')!.geometry!.x).toBe(0);
  });

  it('is an empty page for a null model', () => {
    const g = readGraph(null);
    expect(g.layerIds).toEqual([]);
    expect(g.cells.size).toBe(0);
  });
});

describe('absoluteRect', () => {
  const g = readGraph(
    model(
      vertex('p', 'swimlane;', 'x="100" y="50" width="200" height="100"', 'parent="1"') +
        vertex('c', '', 'x="10" y="30" width="20" height="20"', 'parent="p"') +
        vertex('gc', '', 'x="1" y="2" width="4" height="4"', 'parent="c"') +
        vertex(
          'rel',
          '',
          'x="0.5" y="1" width="10" height="10" relative="1"',
          'parent="p"',
        ).replace(
          'as="geometry"/>',
          'as="geometry"><mxPoint x="-5" y="-5" as="offset"/></mxGeometry>',
        ),
    ),
  );

  it('resolves parent-relative geometry to canvas coordinates', () => {
    expect(absoluteRect(g, 'p')).toEqual({ x: 100, y: 50, width: 200, height: 100 });
    expect(absoluteRect(g, 'c')).toEqual({ x: 110, y: 80, width: 20, height: 20 });
    expect(absoluteRect(g, 'gc')).toEqual({ x: 111, y: 82, width: 4, height: 4 });
  });

  it('resolves relative vertex geometry as a fraction of the parent plus its offset', () => {
    expect(absoluteRect(g, 'rel')).toEqual({ x: 195, y: 145, width: 10, height: 10 });
  });

  it('gives the origin of a parent for edge points', () => {
    expect(originOf(g, '1')).toEqual({ x: 0, y: 0 });
    expect(originOf(g, 'p')).toEqual({ x: 100, y: 50 });
    expect(originOf(g, undefined)).toEqual({ x: 0, y: 0 });
  });

  it('is null for a cell with no geometry or no such cell', () => {
    expect(absoluteRect(g, 'nope')).toBeNull();
  });
});
