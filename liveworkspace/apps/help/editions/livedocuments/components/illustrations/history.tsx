// Undo, Redo and a failed save (liveworkspace/docs/specs/017-help/help-centre.md), on livedocuments' own canvas: a
// picture on a slide stepped back and put back, with the Undo | Redo card in the corner cluster and the shortcut, and
// the message a save that missed the server shows. Drawn with the editor chrome kit (./editor-chrome) and the page kit
// (./doc-page).

import { lucideInfo } from '@liveworkspace/icons/lucide';
import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { BAR_H, BottomBar, Card, CLUSTER_W, CornerCluster, Icon } from './editor-chrome';
import { Heading, Lines, Page, Picture, Rule } from './doc-page';

/** A keyboard shortcut on a small card, its action named under it. */
function KeyCard({ x, y, keys, caption }: { x: number; y: number; keys: string; caption: string }) {
  const w = keys.length * 7 + 18;
  return (
    <g>
      <Card x={x - w / 2} y={y} w={w} h={24}>
        <Label x={x} y={y + 12.5} size={10} weight={650} tone="strong" anchor="middle">
          {keys}
        </Label>
      </Card>
      <Label x={x} y={y + 38} size={9.5} tone="muted" anchor="middle">
        {caption}
      </Label>
    </g>
  );
}

/** The slide both scenes work on: a title, its text and, when `picture` is set, the picture just added (faded and
 *  dashed while it is being stepped back). */
function HistorySlide({ picture }: { picture: 'on' | 'fading' }) {
  return (
    <Page x={30} y={40} w={240} h={135} name="Field Trip">
      <Heading x={48} y={64} size={12}>
        Field Trip
      </Heading>
      <Rule x={48} y={73} />
      <Lines x={48} y={88} w={80} n={4} gap={7} />
      <g opacity={picture === 'fading' ? 0.35 : 1}>
        <Picture x={146} y={58} w={108} h={100} />
      </g>
      {picture === 'fading' && (
        <rect
          x={146}
          y={58}
          width={108}
          height={100}
          rx={2}
          className="fill-none stroke-slate-400"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
    </Page>
  );
}

/** Undo: the picture just added fades off the slide as Cmd or Ctrl plus Z steps it back. */
export function UndoStep() {
  const W = 420;
  const H = 230;
  return (
    <Scene w={W} h={H}>
      <HistorySlide picture="fading" />
      <KeyCard x={344} y={78} keys="⌘ Z" caption="Undo" />
      <CornerCluster x={W - 8 - CLUSTER_W} y={H - 32} canRedo highlight="undo" />
    </Scene>
  );
}

/** Redo: the picture that was undone comes back, from Redo or Cmd or Ctrl plus Shift plus Z. */
export function RedoStep() {
  const W = 420;
  const H = 230;
  return (
    <Scene w={W} h={H}>
      <HistorySlide picture="on" />
      <KeyCard x={344} y={78} keys="⌘ ⇧ Z" caption="Redo" />
      <CornerCluster x={W - 8 - CLUSTER_W} y={H - 32} canRedo highlight="redo" />
    </Scene>
  );
}

/** A save that did not reach the server: the message at the bottom of the screen, over the slide being edited. */
export function SaveFailedToast() {
  const W = 420;
  const H = 210;
  const tw = 300;
  const tx = (W - tw) / 2;
  const ty = H - BAR_H - 44;
  return (
    <Scene w={W} h={H}>
      <Page x={110} y={26} w={200} h={100} name="Results" bar={{ look: false }}>
        <Heading x={126} y={48} size={11}>
          Q3 Results
        </Heading>
        <Lines x={126} y={62} w={90} n={4} gap={7} />
      </Page>
      <Card x={tx} y={ty} w={tw} h={30}>
        <rect x={tx} y={ty} width={3} height={30} rx={1.5} className="fill-rose-500" />
        <Icon prims={lucideInfo} x={tx + 16} y={ty + 15} size={9} className="stroke-rose-600" />
        <Label x={tx + 28} y={ty + 15.5} size={9.5} weight={500} tone="strong">
          Couldn&rsquo;t save your changes. Check your connection.
        </Label>
      </Card>
      <BottomBar y={H - BAR_H} w={W} tabs={['Pitch Deck']} />
    </Scene>
  );
}
