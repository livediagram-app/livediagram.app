// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { ShapeElement, TextElement } from '@livediagram/document';
import { readGraph } from './cells';
import { convertPage } from './convert-page';
import { ReportTally } from './notes';
import { classifyVertex } from './shapes';
import { model, vertex } from './test-support';

// docs/specs/020-import-export/drawio-import.md "BPMN stencils"

const classify = (style: string) => {
  const g = readGraph(model(vertex('v', style, 'width="50" height="50"', 'parent="1" value=""')));
  return classifyVertex(g.cells.get('v')!, g);
};

describe('draw.io BPMN stencils', () => {
  it.each([
    ['shape=mxgraph.bpmn.event;outline=standard;symbol=general;', 'circle', 'start'],
    ['shape=mxgraph.bpmn.event;outline=standard;symbol=message;', 'circle', 'start-message'],
    ['shape=mxgraph.bpmn.event;outline=catching;symbol=timer;', 'circle', 'intermediate-timer'],
    ['shape=mxgraph.bpmn.event;outline=boundInt;symbol=error;', 'circle', 'intermediate-error'],
    ['shape=mxgraph.bpmn.event;outline=end;symbol=terminate;', 'circle', 'end-terminate'],
    ['shape=mxgraph.bpmn.event;', 'circle', 'start'],
    ['shape=mxgraph.bpmn.task;taskMarker=user;', 'square', 'task-user'],
    ['shape=mxgraph.bpmn.task;taskMarker=businessRule;', 'square', 'task-business-rule'],
    ['shape=mxgraph.bpmn.task2;', 'square', 'task'],
    ['shape=mxgraph.bpmn.task;isLoopSub=1;', 'square', 'subprocess'],
    ['shape=mxgraph.bpmn.gateway2;gwType=exclusive;', 'diamond', 'gateway-exclusive'],
    ['shape=mxgraph.bpmn.gateway2;gwType=parallel;', 'diamond', 'gateway-parallel'],
    ['shape=mxgraph.bpmn.gateway2;', 'diamond', 'gateway'],
    [
      'shape=mxgraph.bpmn.shape;perimeter=rhombusPerimeter;symbol=inclusiveGw;',
      'diamond',
      'gateway-inclusive',
    ],
    ['shape=mxgraph.bpmn.shape;perimeter=rhombusPerimeter;symbol=general;', 'diamond', 'gateway'],
    [
      'shape=mxgraph.bpmn.shape;perimeter=ellipsePerimeter;outline=end;symbol=general;',
      'circle',
      'end',
    ],
    ['shape=mxgraph.bpmn.data;', 'document', 'data-object'],
    ['shape=mxgraph.bpmn.data2;', 'document', 'data-object'],
    ['shape=datastore;', 'cylinder', 'data-store'],
  ])('maps %s', (style, shape, bpmn) => {
    expect(classify(style)).toEqual({ kind: 'shape', shape, bpmn, approximated: false });
  });

  it.each([
    ['shape=mxgraph.bpmn.event;outline=standard;symbol=signal;', 'start'],
    ['shape=mxgraph.bpmn.event;outline=end;symbol=timer;', 'end'],
    ['shape=mxgraph.bpmn.event;outline=mystery;symbol=general;', 'start'],
    ['shape=mxgraph.bpmn.task;taskMarker=loop;', 'task'],
    ['shape=mxgraph.bpmn.gateway2;gwType=exclusiveEventBased;', 'gateway'],
    ['shape=mxgraph.bpmn.shape;', 'task'],
  ])('approximates %s', (style, bpmn) => {
    expect(classify(style)).toMatchObject({ kind: 'shape', bpmn, approximated: true });
  });

  it('leaves every other shape alone', () => {
    expect(classify('ellipse;')).toEqual({ kind: 'shape', shape: 'circle', approximated: false });
  });

  it('draws an event with its mark, its outside name a text under it', () => {
    const tally = new ReportTally();
    const page = convertPage(
      readGraph(
        model(
          vertex(
            'e',
            'shape=mxgraph.bpmn.event;outline=end;symbol=message;verticalLabelPosition=bottom;verticalAlign=top;',
            'x="100" y="100" width="50" height="50"',
            'parent="1" value="Sent"',
          ) +
            vertex(
              't',
              'shape=mxgraph.bpmn.task;taskMarker=user;rounded=1;whiteSpace=wrap;',
              'x="200" y="100" width="120" height="80"',
              'parent="1" value="Review"',
            ),
        ),
      ),
      { tally, pageIdToTab: new Map(), scale: 1, images: [], imageKeys: new Map() },
    );
    const event = page.elements.find(
      (e) => e.type === 'shape' && e.bpmn === 'end-message',
    ) as ShapeElement;
    expect(event).toMatchObject({ shape: 'circle', label: '' });
    const name = page.elements.find((e) => e.type === 'text') as TextElement;
    expect(name.label).toBe('Sent');
    expect(name.y).toBeGreaterThanOrEqual(event.y + event.height - 1);
    const task = page.elements.find((e) => e.type === 'shape' && e.bpmn === 'task-user');
    expect(task).toMatchObject({ shape: 'square', label: 'Review' });
    expect(tally.notes().some((n) => n.kind === 'shape-approximated')).toBe(false);
  });
});
