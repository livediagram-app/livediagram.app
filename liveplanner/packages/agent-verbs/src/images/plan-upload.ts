// A picture uploaded for a plan's cards (docs/specs/015-api/mcp-server.md §4.5b, cli.md "Pictures"): the MCP's
// upload_image and the CLI's `image add`. The bytes are judged, fetched and uploaded by the shared gallery upload
// (@liveworkspace/agent-verbs images/upload.ts), through the api's own `POST /api/images?p={projectId}`, as the caller,
// naming the tool. That route keeps every rule (who may add pictures to the plan, type, size, the gallery's caps) and
// records the plan's grant, so change_items may then place the id on a card.
import { ApiError, type ApiClient } from '@liveworkspace/api-client';
import { VerbRefusal } from '../define';
import {
  addImage,
  type ImageFrom,
  type UploadedImage,
  type UploadWords,
} from '@liveworkspace/agent-verbs/images/upload';

// liveplanner lists and removes a person's pictures in one place, the Explorer's Image Gallery: a full gallery's
// refusal names it once.
const GALLERY_WORDS: UploadWords = {
  list: 'the Image Gallery in the Explorer',
  remove: 'the Image Gallery in the Explorer',
};

// The upload route for a plan: the picture goes into the caller's gallery, and the plan records a grant for it.
export const planUploadPath = (projectId: string) => `/images?p=${encodeURIComponent(projectId)}`;

export async function uploadForPlan(
  api: ApiClient,
  projectId: string,
  from: ImageFrom,
  source: 'mcp' | 'cli',
): Promise<UploadedImage> {
  try {
    return await addImage(api, from, {
      source,
      words: GALLERY_WORDS,
      path: planUploadPath(projectId),
    });
  } catch (err) {
    // A Viewer, or a link that only reads (a read-only token says so in its own words).
    if (err instanceof ApiError && err.status === 403 && err.code !== 'read_only_token') {
      throw new VerbRefusal({
        status: 403,
        code: 'forbidden',
        message: 'You can view this plan but not add pictures to it.',
        hint: 'an Editor or a Participant of the plan adds its pictures',
      });
    }
    if (err instanceof ApiError && err.status === 404) {
      throw new VerbRefusal({
        status: 404,
        code: 'not_found',
        message: 'No such plan, or it is not shared with you.',
        hint: 'find_projects lists the plans you can reach',
      });
    }
    throw err;
  }
}
