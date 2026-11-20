// Supported Devices scenes for livedesign (liveworkspace/docs/specs/017-help/help-centre.md): the editor on a
// computer, on a tablet and on a phone. The computer and tablet show the chrome kit's full window scaled into the
// device; the phone shows the phone layout (the menu button and an icon strip across the top, the page, the tabs).

import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { BAR_H, DesignPage, EditorFrame } from './editor-chrome';
import { Glyph, type GlyphName } from './editor-glyphs';
import { PhoneScreen } from './design-content';
import { APP_PAGES, AppScreens } from './user-interface';

/** On a computer: the whole editor in a monitor. */
export function DesktopEditor() {
  const s = 0.56;
  return (
    <Scene w={420} h={270} bg="plain">
      <rect x={20} y={12} width={380} height={236} rx={10} className="fill-slate-800" />
      <g transform={`translate(30 22) scale(${s})`}>
        <rect width={640} height={384} className="fill-slate-50" />
        <EditorFrame w={640} h={384} pages={APP_PAGES} level="60%" tabs={['App Screens', 'Brand']}>
          <AppScreens x={168} y={80} h={240} />
        </EditorFrame>
      </g>
      <path d="M190 248 L184 262 H236 L230 248 Z" className="fill-slate-300" />
    </Scene>
  );
}

/** On a tablet held sideways: the same full layout. */
export function TabletLandscape() {
  const s = 0.52;
  return (
    <Scene w={420} h={250} bg="plain">
      <rect x={36} y={14} width={348} height={222} rx={16} className="fill-slate-800" />
      <g transform={`translate(44 22) scale(${s})`}>
        <rect width={640} height={396} className="fill-slate-50" />
        <EditorFrame w={640} h={396} pages={APP_PAGES} level="60%" tabs={['App Screens', 'Brand']}>
          <AppScreens x={168} y={80} h={240} />
        </EditorFrame>
      </g>
      <circle cx={377} cy={125} r={2.5} className="fill-slate-600" />
    </Scene>
  );
}

/** On a phone: the menu button and the strip's category icons across the top, the page, the tab bar below. */
export function MobileEditor() {
  const x = 150;
  const y = 10;
  const w = 120;
  const h = 236;
  const icons: GlyphName[] = ['shapes', 'write', 'concepts', 'components', 'icons'];
  return (
    <Scene w={420} h={256} bg="plain">
      <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} rx={20} className="fill-slate-800" />
      <rect x={x} y={y} width={w} height={h} rx={14} className="fill-slate-50" />
      <rect x={x + w / 2 - 16} y={y + 4} width={32} height={6} rx={3} className="fill-slate-800" />
      {/* The top row: the menu card, then the strip of category icons. */}
      <rect
        x={x + 5}
        y={y + 16}
        width={17}
        height={17}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Glyph name="menu" x={x + 13.5} y={y + 24.5} s={0.8} />
      <rect
        x={x + 25}
        y={y + 16}
        width={w - 30}
        height={17}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <rect x={x + 27} y={y + 18} width={14} height={13} rx={3} className="fill-brand-50" />
      <Glyph name="select" x={x + 34} y={y + 24.5} brand s={0.7} />
      {icons.map((g, i) => (
        <Glyph key={g} name={g} x={x + 49 + i * 13.5} y={y + 24.5} s={0.75} />
      ))}
      <DesignPage x={x + 20} y={y + 58} w={80} h={130} size="iPhone" bare>
        <PhoneScreen x={x + 25} y={y + 63} w={70} h={120} variant="home" cta="Shop" frame={false} />
      </DesignPage>
      {/* The tab bar along the bottom. */}
      <rect x={x} y={y + h - BAR_H - 10} width={w} height={BAR_H} className="fill-slate-100" />
      <path
        d={`M${x + 6} ${y + h - 10} V${y + h - BAR_H - 2} a4 4 0 0 1 4 -4 H${x + 54} a4 4 0 0 1 4 4 V${y + h - 10}`}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={x + 12} y={y + h - 20} size={9} weight={600} className="fill-brand-600">
        Tab 1
      </Label>
      <Glyph name="dots" x={x + 47} y={y + h - 20} brand />
      <rect
        x={x + w / 2 - 20}
        y={y + h - 6}
        width={40}
        height={2.5}
        rx={1.25}
        className="fill-slate-800"
      />
    </Scene>
  );
}
