// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { ArrowElement, Element, ShapeElement } from '@livediagram/document';
import { BPMN_REPORT_SUBTITLE, bpmnImportOutcome, importBpmn } from './import';
import { BPMN_MAX_DRAWN, BPMN_MAX_FILE_BYTES, BPMN_MAX_XML_ELEMENTS } from './limits';
import { BPMN_REFUSALS } from './read';

// docs/specs/020-import-export/bpmn-import.md

const NS =
  'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" ' +
  'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" ' +
  'xmlns:color="http://www.omg.org/spec/BPMN/non-normative/color/1.0" xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"';

const shape = (el: string, x: number, y: number, w: number, h: number, attrs = '', inner = '') =>
  `<bpmndi:BPMNShape id="${el}_di" bpmnElement="${el}" ${attrs}><dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />${inner}</bpmndi:BPMNShape>`;
const edge = (el: string, pts: [number, number][]) =>
  `<bpmndi:BPMNEdge id="${el}_di" bpmnElement="${el}">${pts
    .map(([x, y]) => `<di:waypoint x="${x}" y="${y}" />`)
    .join('')}</bpmndi:BPMNEdge>`;
const file = (semantic: string, di: string, extraDiagram = '') =>
  `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions ${NS} id="Defs">${semantic}` +
  `<bpmndi:BPMNDiagram id="D1"><bpmndi:BPMNPlane id="P1" bpmnElement="Collab">${di}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>${extraDiagram}</bpmn:definitions>`;

// A small order process as bpmn.io saves it: a pool with two lanes, every family, a message flow from a second pool.
const ORDER =
  file(
    `<bpmn:collaboration id="Collab">
     <bpmn:participant id="Shop" name="Shop" processRef="Proc" />
     <bpmn:participant id="Customer" name="Customer" />
     <bpmn:messageFlow id="MF" sourceRef="Customer" targetRef="Start" />
   </bpmn:collaboration>
   <bpmn:process id="Proc">
     <bpmn:laneSet><bpmn:lane id="Sales" name="Sales" /><bpmn:lane id="Store" name="Store" /></bpmn:laneSet>
     <bpmn:startEvent id="Start" name="Order in"><bpmn:messageEventDefinition /></bpmn:startEvent>
     <bpmn:userTask id="Check" name="Check order">
       <bpmn:dataOutputAssociation id="DOA"><bpmn:targetRef>Stock</bpmn:targetRef></bpmn:dataOutputAssociation>
     </bpmn:userTask>
     <bpmn:exclusiveGateway id="Gw" name="In stock?" />
     <bpmn:parallelGateway id="Split" />
     <bpmn:subProcess id="Ship" name="Ship it" />
     <bpmn:callActivity id="Bill" name="Bill" />
     <bpmn:intermediateCatchEvent id="Wait" name="Wait"><bpmn:signalEventDefinition /></bpmn:intermediateCatchEvent>
     <bpmn:endEvent id="End" name="Done"><bpmn:terminateEventDefinition /></bpmn:endEvent>
     <bpmn:dataStoreReference id="Stock" name="Stock" />
     <bpmn:dataObjectReference id="Inv" name="Invoice" />
     <bpmn:textAnnotation id="Note"><bpmn:text>Ask twice</bpmn:text></bpmn:textAnnotation>
     <bpmn:association id="As" sourceRef="Note" targetRef="Check" />
     <bpmn:group id="Grp" categoryValueRef="CV" />
     <bpmn:sequenceFlow id="F1" name="go" sourceRef="Start" targetRef="Check" />
     <bpmn:sequenceFlow id="F2" sourceRef="Check" targetRef="Gw" />
     <bpmn:sequenceFlow id="F3" sourceRef="Gw" targetRef="Split" />
     <bpmn:sequenceFlow id="Lone" sourceRef="Split" targetRef="Ship" />
     <bpmn:choreographyTask id="Chor" name="Talk" />
   </bpmn:process>
   <bpmn:category id="Cat"><bpmn:categoryValue id="CV" value="Fulfilment" /></bpmn:category>`,
    [
      shape('Shop', 100, 100, 900, 400, 'isHorizontal="true"'),
      shape('Sales', 130, 100, 870, 200, 'isHorizontal="true"'),
      shape('Store', 130, 300, 870, 200, 'isHorizontal="true"'),
      shape('Customer', 100, 0, 900, 80, 'isHorizontal="false"'),
      shape(
        'Start',
        182,
        182,
        36,
        36,
        'color:background-color="#fee2e2" color:border-color="#b91c1c"',
        '<bpmndi:BPMNLabel><dc:Bounds x="170" y="225" width="60" height="14" /></bpmndi:BPMNLabel>',
      ),
      shape('Check', 270, 160, 100, 80, 'bioc:fill="#e0f2fe" bioc:stroke="red"'),
      shape('Gw', 425, 175, 50, 50, 'isMarkerVisible="true"'),
      shape('Split', 525, 175, 50, 50),
      shape('Ship', 620, 160, 100, 80, 'isExpanded="false"'),
      shape('Bill', 620, 360, 100, 80),
      shape('Wait', 760, 182, 36, 36),
      shape('End', 850, 182, 36, 36),
      shape('Stock', 295, 395, 50, 50),
      shape('Inv', 452, 400, 36, 50),
      shape('Note', 270, 40, 100, 30),
      shape('Grp', 600, 140, 140, 320),
      shape('Chor', 800, 360, 100, 80),
    ].join(''),
  ) + '';

const ORDER_EDGES = [
  edge('MF', [
    [200, 80],
    [200, 182],
  ]),
  edge('F1', [
    [218, 200],
    [270, 200],
  ]),
  edge('F2', [
    [370, 200],
    [425, 200],
  ]),
  edge('F3', [
    [475, 200],
    [525, 200],
  ]),
  edge('Lone', [[575, 200]]),
  edge('As', [
    [320, 70],
    [320, 160],
  ]),
  edge('DOA', [
    [320, 240],
    [320, 395],
  ]),
].join('');

const ORDER_FILE = ORDER.replace(
  '</bpmndi:BPMNPlane>',
  `${ORDER_EDGES}</bpmndi:BPMNPlane>`,
).replace(
  '</bpmn:definitions>',
  '<bpmndi:BPMNDiagram id="D2"><bpmndi:BPMNPlane id="P2" /></bpmndi:BPMNDiagram></bpmn:definitions>',
);

function imported(text: string) {
  const result = importBpmn(text);
  if (!result.ok) throw new Error(result.error);
  return result;
}

const shapes = (els: Element[]) => els.filter((e): e is ShapeElement => e.type === 'shape');
const arrows = (els: Element[]) => els.filter((e): e is ArrowElement => e.type === 'arrow');
const byBpmn = (els: Element[], symbol: string) =>
  shapes(els).find((s) => s.bpmn === symbol) as ShapeElement;
const textOf = (els: Element[], label: string) =>
  els.find((e) => e.type === 'text' && 'label' in e && e.label === label);

describe('importBpmn: the mapping', () => {
  const { elements, tally } = imported(ORDER_FILE);

  it('draws each symbol in its bounds, on its kind', () => {
    expect(byBpmn(elements, 'start-message')).toMatchObject({
      shape: 'circle',
      x: 182,
      y: 182,
      width: 36,
    });
    expect(byBpmn(elements, 'task-user')).toMatchObject({ shape: 'square', label: 'Check order' });
    expect(byBpmn(elements, 'gateway-exclusive')).toMatchObject({ shape: 'diamond' });
    expect(byBpmn(elements, 'gateway-parallel')).toBeDefined();
    expect(byBpmn(elements, 'data-store')).toMatchObject({ shape: 'cylinder' });
    expect(byBpmn(elements, 'data-object')).toMatchObject({ shape: 'document' });
    expect(byBpmn(elements, 'end-terminate')).toBeDefined();
  });

  it('keeps colours that are hex and ignores the rest', () => {
    expect(byBpmn(elements, 'start-message')).toMatchObject({
      fillColor: '#fee2e2',
      strokeColor: '#b91c1c',
    });
    const check = byBpmn(elements, 'task-user');
    expect(check.fillColor).toBe('#e0f2fe');
    expect(check.strokeColor).toBeUndefined();
  });

  it('puts an event, gateway and data name in text under it, at the label bounds when given', () => {
    expect(textOf(elements, 'Order in')).toMatchObject({ x: 170, y: 225 });
    expect(textOf(elements, 'In stock?')).toMatchObject({ y: 229 });
    expect(textOf(elements, 'Stock')).toBeDefined();
    expect(byBpmn(elements, 'gateway-exclusive').label).toBe('');
  });

  it('draws pools and lanes as lanes, upright unless vertical, under everything', () => {
    const lanes = shapes(elements).filter((s) => s.shape === 'lane');
    expect(lanes.map((l) => l.label)).toEqual(['Shop', 'Sales', 'Store', 'Customer']);
    expect(lanes[0]).toMatchObject({ titleOrientation: 'upright', headerSize: 30 });
    expect(lanes[3]).toMatchObject({ textAlignY: 'top' });
    expect(lanes[3]!.titleOrientation).toBeUndefined();
    expect(elements.slice(0, 4).every((e) => e.type === 'shape' && e.shape === 'lane')).toBe(true);
  });

  it('approximates what it has no symbol for and says so', () => {
    expect(byBpmn(elements, 'subprocess')).toBeDefined();
    expect(shapes(elements).filter((s) => s.bpmn === 'subprocess')).toHaveLength(2);
    expect(byBpmn(elements, 'intermediate')).toBeDefined();
    // Bill (a call activity) and Wait (a signal) are approximated.
    expect(tally.approximated).toBe(2);
    expect(tally.vertical).toBe(1);
    expect(tally.unmatched.get('choreographyTask')).toBe(1);
    expect(shapes(elements).find((s) => s.label === 'Talk')).toMatchObject({ shape: 'square' });
  });

  it('draws an annotation as text and a group as a dashed frame titled by its category', () => {
    expect(textOf(elements, 'Ask twice')).toBeDefined();
    expect(shapes(elements).find((s) => s.shape === 'frame')).toMatchObject({
      label: 'Fulfilment',
      strokeStyle: 'dashed',
    });
  });

  it('pins each flow to the elements it joins, in its look', () => {
    const lines = arrows(elements);
    expect(lines).toHaveLength(6);
    const go = lines.find((a) => a.label === 'go')!;
    expect(go.from).toMatchObject({
      kind: 'pinned',
      elementId: byBpmn(elements, 'start-message').id,
    });
    expect(go.to).toMatchObject({ kind: 'pinned', elementId: byBpmn(elements, 'task-user').id });
    const message = lines.find((a) => a.arrowheadStartShape === 'circle-hollow')!;
    expect(message).toMatchObject({ strokeStyle: 'dashed', arrowEnds: 'both' });
    const dotted = lines.filter((a) => a.strokeStyle === 'dotted');
    expect(dotted).toHaveLength(2);
    // The data output association keeps a line head at the store.
    const toStore = dotted.find((a) => a.arrowEnds === 'to')!;
    expect(toStore.to).toMatchObject({ elementId: byBpmn(elements, 'data-store').id });
    expect(toStore.from).toMatchObject({ elementId: byBpmn(elements, 'task-user').id });
  });

  it('counts the flow without a route and the second diagram', () => {
    expect(tally.unrouted).toBe(1);
    expect(tally.otherDiagrams).toBe(1);
  });

  it('reports what changed on the way', () => {
    const outcome = bpmnImportOutcome(elements, tally);
    expect(outcome).toMatchObject({ status: 'done', subtitle: BPMN_REPORT_SUBTITLE });
    const text = JSON.stringify(outcome);
    expect(text).toContain('choreographyTask');
    expect(text).toContain('only the first is drawn');
    expect(text).toContain('Vertical pools');
  });
});

describe('importBpmn: edge cases', () => {
  it('leaves an end free when its element is not drawn, and bends through the waypoints', () => {
    const text = file(
      '<bpmn:process id="P"><bpmn:task id="A" name="A" /><bpmn:sequenceFlow id="F" sourceRef="A" targetRef="Gone" /></bpmn:process>',
      shape('A', 0, 0, 100, 80) +
        edge('F', [
          [100, 40],
          [200, 40],
          [200, 200],
          [300, 200],
        ]),
    );
    const { elements } = imported(text);
    const line = arrows(elements)[0]!;
    expect(line.from).toMatchObject({ kind: 'pinned' });
    expect(line.to).toEqual({ kind: 'free', x: 300, y: 200 });
    expect(line.arrowStyle).toBe('angled');
    expect(line.curvePoints?.length).toBeGreaterThan(0);
  });

  it('draws an expanded sub-process as a frame, a data input association into its activity', () => {
    const text = file(
      `<bpmn:process id="P">
         <bpmn:subProcess id="S" name="Pack" />
         <bpmn:task id="T" name="Use"><bpmn:dataInputAssociation id="DIA"><bpmn:sourceRef>D</bpmn:sourceRef><bpmn:targetRef>In</bpmn:targetRef></bpmn:dataInputAssociation></bpmn:task>
         <bpmn:dataObjectReference id="D" />
         <bpmn:association id="A2" sourceRef="D" targetRef="T" associationDirection="Both" />
         <bpmn:exclusiveGateway id="G" />
         <bpmn:boundaryEvent id="B"><bpmn:timerEventDefinition /></bpmn:boundaryEvent>
         <bpmn:startEvent id="SE"><bpmn:errorEventDefinition /></bpmn:startEvent>
       </bpmn:process>`,
      shape('S', 0, 0, 300, 200, 'isExpanded="true"') +
        shape('T', 400, 0, 100, 80) +
        shape('D', 400, 200, 36, 50) +
        shape('G', 600, 0, 50, 50) +
        shape('B', 480, 60, 36, 36) +
        shape('SE', 700, 0, 36, 36) +
        shape('Nowhere', 800, 0, 50, 50) +
        edge('DIA', [
          [418, 200],
          [418, 80],
        ]) +
        edge('A2', [
          [436, 225],
          [450, 80],
        ]),
    );
    const { elements, tally } = imported(text);
    expect(shapes(elements).find((s) => s.shape === 'frame')).toMatchObject({ label: 'Pack' });
    const [dia, both] = arrows(elements);
    expect(dia!.to).toMatchObject({
      elementId: shapes(elements).find((s) => s.label === 'Use')!.id,
    });
    expect(both).toMatchObject({ arrowEnds: 'both', arrowheadShape: 'line' });
    expect(byBpmn(elements, 'gateway')).toBeDefined();
    expect(byBpmn(elements, 'intermediate-timer')).toBeDefined();
    expect(byBpmn(elements, 'start')).toBeDefined();
    // The expanded sub-process and the start error are approximated; the unknown ref is unmatched.
    expect(tally.approximated).toBe(2);
    expect(tally.unmatched.get('unknown')).toBe(1);
  });

  it('says nothing when everything came across', () => {
    const text = file(
      '<bpmn:process id="P"><bpmn:task id="A" /></bpmn:process>',
      shape('A', 0, 0, 100, 80),
    );
    const { elements, tally } = imported(text);
    expect(bpmnImportOutcome(elements, tally)).toEqual({ status: 'done' });
  });
});

describe('importBpmn: refusals', () => {
  it.each([
    ['not XML', 'hello', BPMN_REFUSALS.notXml],
    ['broken XML', '<bpmn:definitions', BPMN_REFUSALS.notXml],
    ['another XML', '<mxfile><diagram /></mxfile>', BPMN_REFUSALS.notBpmn],
    [
      'no diagram',
      `<definitions><process id="P"><task id="A" /></process></definitions>`,
      BPMN_REFUSALS.noDiagram,
    ],
  ])('refuses %s', (_name, text, message) => {
    expect(importBpmn(text)).toEqual({ ok: false, error: message });
  });

  it('refuses a file over the size cap unread', () => {
    expect(importBpmn('<'.padEnd(BPMN_MAX_FILE_BYTES + 1, ' '))).toEqual({
      ok: false,
      error: BPMN_REFUSALS.tooLarge,
    });
  });

  it('refuses a file past the element cap', () => {
    const many = '<task/>'.repeat(BPMN_MAX_XML_ELEMENTS);
    expect(importBpmn(`<definitions><process>${many}</process></definitions>`)).toEqual({
      ok: false,
      error: BPMN_REFUSALS.tooComplex,
    });
  });

  it('lets no script or entity in: the file is parsed inert and only named attributes are read', () => {
    const text = file(
      '<bpmn:process id="P"><bpmn:task id="A" name="&lt;img src=x onerror=alert(1)&gt;" /><script>alert(1)</script></bpmn:process>',
      shape('A', 0, 0, 100, 80),
    );
    const { elements } = imported(text);
    expect(shapes(elements)[0]!.label).toBe('<img src=x onerror=alert(1)>');
    expect(elements.some((e) => e.type === 'shape' && e.label === '')).toBe(false);
  });
});

// The worst case the caps allow: the drawn cap of tasks in a chain, each joined to the next, plus semantic elements
// up to near the walk's cap. Every step is one pass with maps by id, so it stays well inside a CPU budget.
describe('importBpmn: a large worst-case file', () => {
  const n = BPMN_MAX_DRAWN;
  const semantic: string[] = [];
  const di: string[] = [];
  for (let i = 0; i < n; i += 1) {
    semantic.push(`<bpmn:userTask id="T${i}" name="Task ${i}" />`);
    if (i > 0)
      semantic.push(`<bpmn:sequenceFlow id="F${i}" sourceRef="T${i - 1}" targetRef="T${i}" />`);
    const x = (i % 40) * 150;
    const y = Math.floor(i / 40) * 120;
    di.push(shape(`T${i}`, x, y, 100, 80));
    if (i > 0)
      di.push(
        edge(`F${i}`, [
          [x - 50, y + 40],
          [x, y + 40],
        ]),
      );
  }
  const text = file(`<bpmn:process id="P">${semantic.join('')}</bpmn:process>`, di.join(''));

  it(`draws ${n} tasks and their flows inside ${cpuBudgetMs(1500)} ms of CPU`, () => {
    importBpmn(text);
    const best = Math.min(...[0, 1].map(() => cpuMsOf(() => void importBpmn(text))));
    expect(best).toBeLessThan(cpuBudgetMs(1500));
    const result = imported(text);
    expect(result.tally.shapes).toBe(n);
    expect(result.tally.lines).toBe(0);
    expect(result.tally.leftOut).toBe(n - 1);
  });
});
