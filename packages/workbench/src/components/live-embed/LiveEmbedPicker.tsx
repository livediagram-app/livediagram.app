'use client';

// Embed File (liveworkspace/docs/specs/004-index/live-embeds.md "Making one", Work Tracker 1375): the chooser
// (./LiveEmbedChooser) in its dialog, under its illustrated header; choosing closes it.
import { useId } from 'react';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { liveEmbedPickerHeroArt } from '@liveworkspace/ui/dialog-hero-art/live-embed-picker';
import { Dialog } from '../dialogs/Dialog';
import { liveEmbedWords } from './live-embed-words';
import { LiveEmbedChooser, type LiveEmbedChooserProps } from './LiveEmbedChooser';

export {
  embedConnects,
  LIVE_PICKER_CONNECTED_MAX,
  type LiveEmbedConnect,
} from './LiveEmbedChooser';

export function LiveEmbedPicker(props: LiveEmbedChooserProps) {
  const titleId = useId();
  return (
    <Dialog open onClose={props.onClose} titleId={titleId} size="lg" className="max-h-[90vh]">
      <HeroDialogHeader
        art={liveEmbedPickerHeroArt}
        titleId={titleId}
        title={liveEmbedWords.title}
        subtitle={liveEmbedWords.subtitle}
        onClose={props.onClose}
      />
      <LiveEmbedChooser {...props} />
    </Dialog>
  );
}
