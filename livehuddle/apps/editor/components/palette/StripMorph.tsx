'use client';

// The Edit | Walk switch's morph, its React half (docs/specs/007-editor/toolbar-layout.md "Switching morphs the
// strip"; the DOM half is strip-morph-dom.ts). A class for one lifecycle hooks have no match for:
// `getSnapshotBeforeUpdate` runs once React has rendered the flip and before it touches the DOM, so the outgoing
// strip is still on screen to capture, without reading the DOM during render. `componentDidUpdate` then plays the
// morph once the incoming strip is laid out, before it paints. Only a flip of `walking` captures anything: never a
// load, a reload, Zen or a resize. Reduced motion captures nothing (captureStrip), so the switch is instant.
import { Component, type RefObject } from 'react';
import { captureStrip, playStripMorph, type StripSnapshot } from './strip-morph-dom';

type Props = {
  walking: boolean;
  // The canvas wrapper; the strips are inside its parent (one editor's chrome: a split view has two).
  wrapperRef: RefObject<HTMLElement | null>;
};

export class StripMorph extends Component<Props> {
  private stop: (() => void) | null = null;

  override getSnapshotBeforeUpdate(prev: Props): StripSnapshot | null {
    if (prev.walking === this.props.walking) return null;
    return captureStrip(this.props.wrapperRef.current?.parentElement);
  }

  override componentDidUpdate(prev: Props, _state: unknown, from: StripSnapshot | null) {
    if (prev.walking === this.props.walking) return;
    // A quick second press: the morph under way gives way to the new one.
    this.end();
    if (!from) return;
    this.stop = playStripMorph(
      this.props.wrapperRef.current?.parentElement,
      from,
      this.props.walking ? 'walk' : 'edit',
    );
  }

  override componentWillUnmount() {
    this.end();
  }

  private end() {
    this.stop?.();
    this.stop = null;
  }

  override render() {
    return null;
  }
}
