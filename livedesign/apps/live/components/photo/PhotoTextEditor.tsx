'use client';

// Typing into a text layer (docs/specs/031-photo/photo-tools.md "Text"): a field over the layer whose
// own letters are see-through, so what shows is the layer itself drawn live on the photo, with the
// caret and the selection over it. Escape, Ctrl/Cmd+Enter or a press outside ends the edit (one edit
// for the whole typing); an empty text layer is removed as it ends.
import { useEffect, useRef, useState } from 'react';
import { resolveFontStack } from '@livedesign/design';
import type { PhotoTextEdit } from '@/hooks/editor/usePhotoEditor';
import type { PhotoSession } from '@/lib/photo-editor/session';
import { textBox } from '@/lib/photo-editor/text-raster';
import { beginTextEdit, type TextEdit } from '@/lib/photo-editor/tools/text-tool';

export function PhotoTextEditor({
  session,
  edit,
  page,
  onEnd,
}: {
  session: PhotoSession;
  edit: PhotoTextEdit;
  page: { width: number; height: number };
  onEnd: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  // Begun once mounted (it marks the undo checkpoint), ended with the field: focus moved on, the
  // tool put down, the page left.
  const typing = useRef<TextEdit | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(() => {
    const l = session.layer(edit.layerId);
    return l?.layerKind === 'text' ? l.text.text : '';
  });
  useEffect(() => {
    const t = beginTextEdit(session, edit.layerId, edit.isNew);
    typing.current = t;
    ref.current?.focus();
    return () => {
      t?.end();
      typing.current = null;
    };
  }, [session, edit.layerId, edit.isNew]);
  const layer = session.layer(edit.layerId);
  if (!layer || layer.layerKind !== 'text') return null;
  const spec = layer.text;
  const box = textBox(layer);
  const k = page.width / session.photo.width;
  const end = () => {
    typing.current?.end();
    onEnd();
  };
  return (
    <textarea
      ref={ref}
      aria-label="Text"
      dir="auto"
      value={value}
      spellCheck={false}
      onChange={(e) => {
        setValue(e.target.value);
        typing.current?.change({ text: e.target.value });
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          end();
        }
      }}
      onBlur={end}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute resize-none overflow-hidden border border-dashed border-brand-500 bg-transparent p-0 outline-none"
      style={{
        left: box.x * k,
        top: box.y * k,
        width: Math.max(box.width, spec.size) * k,
        height: Math.max(box.height, spec.size * (spec.lineHeight ?? 1.2)) * k,
        font: `${spec.italic ? 'italic ' : ''}${spec.weight} ${spec.size * k}px/${spec.lineHeight ?? 1.2} ${resolveFontStack(spec.font) ?? 'Inter, sans-serif'}`,
        letterSpacing: `${(spec.tracking ?? 0) * spec.size * k}px`,
        textAlign: spec.align === 'centre' ? 'center' : spec.align,
        unicodeBidi: 'plaintext',
        color: 'transparent',
        caretColor: spec.colour,
        whiteSpace: spec.boxWidth ? 'pre-wrap' : 'pre',
      }}
    />
  );
}
