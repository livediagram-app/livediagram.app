// Embeds (docs/specs/009-elements/youtube-video.md, website-embed.md): the URL rules live in
// @liveworkspace/model-core; livedocuments binds the one thing that is its own, the host Figma is told.
import { createEmbedTargetFor } from '@liveworkspace/model-core/youtube';

export {
  EMBED_PROVIDERS,
  EMBED_PROVIDER_HINT,
  EMBED_PROVIDER_LABEL,
  youtubeEmbedUrl,
  youtubePosterUrl,
  youtubeVideoId,
  type EmbedProvider,
  type EmbedTarget,
} from '@liveworkspace/model-core/youtube';

export const embedTargetFor = createEmbedTargetFor('livedocuments');
