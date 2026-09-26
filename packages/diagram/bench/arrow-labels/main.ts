// The arrow label bench (docs/specs/008-canvas/arrow-labels.md "Open decisions").
// Renders every scenario through the real export renderer, once per angled
// strategy, with the caps and knockout rule switchable. Runs in the browser so
// text is measured the way the canvas measures it.

import {
  ALONG_CAP_PX,
  CROSS_CAP_PX,
  renderElementsToSvg,
  type AngledLabelStrategy,
  type ArrowLabelLayoutOptions,
} from '../../src/index';
import { SCENARIOS } from './scenarios';

const STRATEGIES: { id: AngledLabelStrategy; name: string; blurb: string }[] = [
  {
    id: 'route-middle',
    name: 'A. Route middle',
    blurb: 'Middle of the whole path; may sit on a corner.',
  },
  {
    id: 'longest-segment',
    name: 'B. Longest segment',
    blurb: 'Centre of the longest straight run.',
  },
  {
    id: 'middle-segment',
    name: 'C. Middle segment',
    blurb: 'Centre of the run the path middle falls on.',
  },
  {
    id: 'horizontal-preferred',
    name: 'D. Horizontal preferred',
    blurb: 'Longest horizontal run that holds the label, else B.',
  },
];

type State = {
  crossCapPx: number;
  alongCapPx: number;
  knockoutOthers: boolean;
  dark: boolean;
  only: string;
};

const params = new URLSearchParams(location.search);
const state: State = {
  crossCapPx: Number(params.get('cross') ?? CROSS_CAP_PX),
  alongCapPx: Number(params.get('along') ?? ALONG_CAP_PX),
  knockoutOthers: params.get('others') === '1',
  dark: params.get('theme') !== 'light',
  only: params.get('only') ?? '',
};

function sync(): void {
  const p = new URLSearchParams();
  p.set('cross', String(state.crossCapPx));
  p.set('along', String(state.alongCapPx));
  if (state.knockoutOthers) p.set('others', '1');
  if (!state.dark) p.set('theme', 'light');
  if (state.only) p.set('only', state.only);
  history.replaceState(null, '', `?${p}`);
}

function choice<T extends string | number>(
  label: string,
  values: T[],
  current: T,
  set: (v: T) => void,
): HTMLElement {
  const group = document.createElement('fieldset');
  group.innerHTML = `<legend>${label}</legend>`;
  for (const v of values) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(v);
    b.setAttribute('aria-pressed', String(v === current));
    b.onclick = () => {
      set(v);
      render();
    };
    group.append(b);
  }
  return group;
}

function render(): void {
  sync();
  document.documentElement.dataset.theme = state.dark ? 'dark' : 'light';
  const controls = document.getElementById('controls')!;
  controls.replaceChildren(
    choice('Cap across vertical runs (px)', [120, 160, 200], state.crossCapPx, (v) => {
      state.crossCapPx = v;
    }),
    choice('Cap along horizontal runs (px)', [200, 240, 320], state.alongCapPx, (v) => {
      state.alongCapPx = v;
    }),
    choice(
      'Knock out crossing arrows',
      ['own line only', 'all lines'],
      state.knockoutOthers ? 'all lines' : 'own line only',
      (v) => {
        state.knockoutOthers = v === 'all lines';
      },
    ),
    choice('Canvas', ['dark', 'light'], state.dark ? 'dark' : 'light', (v) => {
      state.dark = v === 'dark';
    }),
    choice('Scenario', ['all', ...SCENARIOS.map((s) => s.id)], state.only || 'all', (v) => {
      state.only = v === 'all' ? '' : v;
    }),
  );
  const grid = document.getElementById('grid')!;
  grid.replaceChildren();
  for (const sc of SCENARIOS) {
    if (state.only && sc.id !== state.only) continue;
    const row = document.createElement('section');
    row.className = 'scenario';
    row.dataset.scenario = sc.id;
    row.innerHTML = `<h2>${sc.title}</h2><p>${sc.note}</p>`;
    const cells = document.createElement('div');
    cells.className = 'cells';
    // Strategies only differ on angled arrows; everything else renders once, full size.
    const angled = sc.elements.some((e) => e.type === 'arrow' && e.arrowStyle === 'angled');
    cells.classList.toggle('single', !angled);
    for (const st of angled ? STRATEGIES : STRATEGIES.slice(1, 2)) {
      const options: Partial<ArrowLabelLayoutOptions> = {
        angledStrategy: st.id,
        crossCapPx: state.crossCapPx,
        alongCapPx: state.alongCapPx,
        knockoutOthers: state.knockoutOthers,
      };
      const cell = document.createElement('figure');
      if (angled) cell.dataset.strategy = `${st.name}: ${st.blurb}`;
      // An <img> per render, so each SVG's mask ids stay its own.
      const svg = renderElementsToSvg(
        { id: sc.id, name: sc.title, elements: sc.elements },
        { arrowLabels: options, background: state.dark ? '#0f172a' : '#ffffff', padding: 24 },
      );
      const img = document.createElement('img');
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      img.alt = `${sc.title}, ${st.name}`;
      cell.append(img);
      cells.append(cell);
    }
    row.append(cells);
    grid.append(row);
  }
}

render();
