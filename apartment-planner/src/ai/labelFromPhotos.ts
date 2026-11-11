import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Project } from '../model/types';
import { pointInPolygon } from '../geometry/polygon';

/**
 * Optional: ask Claude to look at the user's room photos and suggest a name and
 * color for each piece in the plan. This is the only part of the app that talks
 * to a server. It runs only when the user enters their own Anthropic API key and
 * clicks the button; the photos and the list of pieces go straight from the
 * browser to the Anthropic API.
 */

const Suggestions = z.object({
  pieces: z.array(
    z.object({
      id: z.string(),
      visible: z.boolean().describe('True only if this piece can actually be seen in at least one photo'),
      name: z.string().describe('Short specific name, e.g. "Green velvet sofa" or "Oak bookshelf"'),
      color: z.string().describe('Dominant color of the piece as a #rrggbb hex string'),
      note: z.string().describe('One short phrase on what identified it, or why it is uncertain'),
    }),
  ),
  floorColor: z.string().nullable().describe('#rrggbb of the floor if visible, else null'),
  wallColor: z.string().nullable().describe('#rrggbb of the walls if visible, else null'),
});

export type PhotoSuggestions = z.infer<typeof Suggestions>;

export interface PhotoInput {
  name: string;
  /** JPEG data URL. */
  dataUrl: string;
}

/** What Claude is told about each piece: enough to match it to what's in a photo. */
export function describePieces(project: Project) {
  return project.furniture.map((f) => ({
    id: f.id,
    currentName: f.name,
    kind: f.kind,
    room: project.rooms.find((r) => pointInPolygon({ x: f.x, y: f.y }, r.polygon))?.name ?? 'unknown',
    widthIn: f.width,
    depthIn: f.depth,
    heightIn: f.height,
    wallMounted: f.elevation > 12,
  }));
}

const SYSTEM = `You help label a 3D model of someone's apartment. You get photos of their rooms and a JSON list of the furniture pieces already in the model (from a LiDAR scan, so sizes are accurate but names are generic, like "Storage 2").

For each piece in the list, decide whether you can see it in the photos, matching by kind, size, and which room it is in. For pieces you can see, give a short specific name a person would use for it and its dominant color as a #rrggbb hex value sampled from the photo. For pieces you cannot confidently find, set visible to false and keep the current name; do not guess. Return every id from the list exactly once and no others.`;

export const MAX_PHOTOS = 8;

export async function suggestFromPhotos(apiKey: string, project: Project, photos: PhotoInput[]): Promise<PhotoSuggestions> {
  // The key is the user's own and never leaves their browser except to api.anthropic.com.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const content: Anthropic.ContentBlockParam[] = [];
  for (const p of photos.slice(0, MAX_PHOTOS)) {
    const [, mediaType, data] = p.dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.*)$/) ?? [];
    if (!data) continue;
    content.push({ type: 'text', text: `Photo: ${p.name}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg', data } });
  }
  if (content.length === 0) throw new Error('Add at least one photo first.');
  content.push({ type: 'text', text: `Pieces in the model:\n${JSON.stringify(describePieces(project), null, 1)}` });

  try {
    const response = await client.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
      output_config: { format: zodOutputFormat(Suggestions) },
    });
    if (response.stop_reason === 'refusal') throw new Error('Claude declined to look at these photos. Try different photos, or set names and colors by hand.');
    if (!response.parsed_output) throw new Error('Claude returned an answer that could not be read. Try again.');
    return response.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('That API key was not accepted. Check it and try again.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error('This API key is not allowed to use that model.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Rate limited by the Anthropic API. Wait a minute and try again.');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Could not reach the Anthropic API. Check your connection.');
    if (e instanceof Anthropic.APIError) throw new Error(`Anthropic API error (${e.status ?? 'unknown'}): ${e.message}`);
    throw e;
  }
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Keep only suggestions that refer to real pieces, are marked visible, and carry a valid color. */
export function usableSuggestions(project: Project, s: PhotoSuggestions) {
  const ids = new Set(project.furniture.map((f) => f.id));
  return {
    pieces: s.pieces.filter((p) => ids.has(p.id) && p.visible).map((p) => ({ ...p, name: p.name.trim().slice(0, 60), color: HEX.test(p.color) ? p.color.toLowerCase() : null })),
    floorColor: s.floorColor && HEX.test(s.floorColor) ? s.floorColor.toLowerCase() : null,
    wallColor: s.wallColor && HEX.test(s.wallColor) ? s.wallColor.toLowerCase() : null,
  };
}
