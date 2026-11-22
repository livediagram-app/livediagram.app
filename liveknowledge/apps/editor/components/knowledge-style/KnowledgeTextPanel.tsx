'use client';

// Knowledgebase Style's Text panel (docs/specs/030-knowledgebase/page-surface.md "Fine-tune"): the heading font and
// the body font, the text size, the line spacing and the heading style, over a sample page that follows each
// choice. Every choice is the whole knowledgebase's at once, one undo step.
import {
  FONTS,
  resolveFontStack,
  type KnowledgeHeadingStyle,
  type KnowledgeLineSpacing,
  type KnowledgeStyle,
  type KnowledgeTextSize,
} from '@liveknowledge/document';
import { Select } from '@liveknowledge/ui';
import { SECTION_LABEL } from '@liveworkspace/workbench/components/dialogs/tab-style/LooksHome';
import { useKnowledgeStylePanel } from './knowledge-style-context';
import { StylePagePreview } from './StylePagePreview';
import { StyleSegmented } from './StyleSegmented';
import { PANEL_HEIGHT } from '@/lib/knowledge-style/knowledge-style-words';

const SIZES: readonly (readonly [KnowledgeTextSize, string])[] = [
  ['small', 'Small'],
  ['medium', 'Medium'],
  ['large', 'Large'],
];
const SPACINGS: readonly (readonly [KnowledgeLineSpacing, string])[] = [
  ['compact', 'Compact'],
  ['comfortable', 'Comfortable'],
  ['relaxed', 'Relaxed'],
];
const HEADINGS: readonly (readonly [KnowledgeHeadingStyle, string])[] = [
  ['plain', 'Plain'],
  ['ruled', 'Ruled'],
];

// Every face a page can be set in but the monospaced one, which is the code blocks' own.
const FACES = FONTS.filter((f) => f.id !== 'roboto-mono');

export function KnowledgeTextPanel() {
  const { style, change } = useKnowledgeStylePanel();
  const set = (patch: Partial<KnowledgeStyle>) => change({ ...style, ...patch }, 'Text');
  return (
    <div className={`flex flex-col gap-3 pt-3 ${PANEL_HEIGHT}`}>
      <StylePagePreview style={style} label="A sample page in this knowledgebase’s text style" />
      <section aria-labelledby="style-fonts" className="flex flex-col gap-2">
        <h3 id="style-fonts" className={SECTION_LABEL}>
          Typefaces
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FontSelect
            label="Heading Font"
            value={style.headingFont}
            onChange={(headingFont) => set({ headingFont })}
          />
          <FontSelect
            label="Body Font"
            value={style.bodyFont}
            onChange={(bodyFont) => set({ bodyFont })}
          />
        </div>
      </section>
      <section aria-labelledby="style-size" className="flex flex-col gap-3">
        <h3 id="style-size" className={SECTION_LABEL}>
          Size and Spacing
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StyleSegmented
            label="Text Size"
            value={style.textSize}
            options={SIZES}
            onChange={(textSize) => set({ textSize })}
          />
          <StyleSegmented
            label="Heading Style"
            value={style.headingStyle}
            options={HEADINGS}
            onChange={(headingStyle) => set({ headingStyle })}
          />
        </div>
        <StyleSegmented
          label="Line Spacing"
          value={style.lineSpacing}
          options={SPACINGS}
          onChange={(lineSpacing) => set({ lineSpacing })}
        />
      </section>
    </div>
  );
}

function FontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (font: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300">
      {label}
      <Select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontFamily: resolveFontStack(value) }}
        className="max-sm:min-h-11"
      >
        {FACES.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
