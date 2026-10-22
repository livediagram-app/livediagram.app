import { Glyph } from '@livepages/ui';

// A filled play triangle: the slide deck's Play and the element tour offer's (docs/specs/007-editor/element-tours.md).
export function PlayIcon({ size = 12 }: { size?: number }) {
  return (
    <Glyph size={size} units={12} filled>
      <path d="M3 1.8 10 6l-7 4.2z" />
    </Glyph>
  );
}
