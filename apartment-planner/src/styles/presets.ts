import type { Palette, RoomType } from '../model/types';

export type RugPolicy = 'floating' | 'front-legs' | 'all-legs' | 'layered';

export type IdeaCategory = 'Walls' | 'Lighting' | 'Storage' | 'Windows' | 'Textiles' | 'Decor' | 'Kitchen & bath';

export interface Idea {
  category: IdeaCategory;
  text: string;
  /** Removable/reversible without landlord approval. */
  renterFriendly: boolean;
  /** Shown instead of `text` in renter mode when the idea isn't renter-friendly. */
  renterAlt?: string;
}

export interface RoomSuggestion {
  /** Catalog ids to suggest, in priority order. */
  furniture: string[];
  tips: string[];
}

export interface StylePreset {
  id: string;
  name: string;
  tagline: string;
  palette: Palette;
  rugPolicy: RugPolicy;
  rugNote: string;
  rooms: Partial<Record<RoomType, RoomSuggestion>>;
  ideas: Idea[];
}

/** Fallbacks for room types a preset doesn't customize. */
export const BASE_ROOM_SUGGESTIONS: Record<RoomType, RoomSuggestion> = {
  living: { furniture: ['sofa-3', 'coffee-table', 'armchair', 'tv-stand', 'floor-lamp'], tips: [] },
  bedroom: { furniture: ['bed-queen', 'nightstand', 'dresser'], tips: ['Leave 24"+ on each side of the bed you get out of, and 30"+ at the foot.'] },
  dining: { furniture: ['dining-4', 'dining-chair'], tips: ['Allow 36" from the table edge to walls so chairs can pull out.'] },
  office: { furniture: ['desk', 'office-chair', 'bookshelf'], tips: ['Put the desk perpendicular to the window to cut screen glare.'] },
  kitchen: { furniture: ['kitchen-cart', 'bar-stool'], tips: ['Keep 42" in front of counters for working and opening doors.'] },
  bathroom: { furniture: ['bath-mat', 'ladder-shelf'], tips: ['Use over-the-toilet or over-the-door storage before adding floor pieces.'] },
  entry: { furniture: ['console', 'shoe-rack', 'mirror'], tips: ['A mirror plus a narrow console makes a small entry feel bigger.'] },
  other: { furniture: ['bookshelf', 'accent-chair', 'floor-lamp'], tips: [] },
};

/** Renter basics shown in renter mode regardless of preset. */
export const RENTER_BASICS: Idea[] = [
  { category: 'Walls', text: 'Peel-and-stick wallpaper or removable paint for an accent wall', renterFriendly: true },
  { category: 'Walls', text: 'Hang art with picture-hanging strips or a lean-against-the-wall gallery ledge', renterFriendly: true },
  { category: 'Lighting', text: 'Plug-in wall sconces with cord covers instead of hardwired fixtures', renterFriendly: true },
  { category: 'Lighting', text: 'Swap harsh bulbs for 2700K warm LEDs; keep the originals to reinstall', renterFriendly: true },
  { category: 'Windows', text: 'Tension rods or adhesive hooks for curtains, no drilling needed', renterFriendly: true },
  { category: 'Storage', text: 'Freestanding shelving, over-door organizers, and under-bed bins', renterFriendly: true },
  { category: 'Kitchen & bath', text: 'Peel-and-stick backsplash tiles and swapped cabinet pulls (keep the originals)', renterFriendly: true },
  { category: 'Decor', text: 'Layer a large rug over existing flooring to change the whole feel', renterFriendly: true },
];

export const PRESETS: StylePreset[] = [
  {
    id: 'japandi',
    name: 'Japandi',
    tagline: 'Calm, low, natural. Japanese restraint meets Scandi warmth.',
    palette: { walls: '#e9e4da', floor: '#d8c7ad', wood: '#a47c55', textile: '#cfc6b8', accents: ['#b9ad9a', '#5f6b5c', '#2f2c29'] },
    rugPolicy: 'floating',
    rugNote: 'A smaller, flat-woven rug that leaves plenty of floor showing',
    rooms: {
      living: { furniture: ['sofa-apt', 'coffee-table-round', 'ottoman', 'console', 'plant-large'], tips: ['Choose low-profile pieces; keep surfaces mostly clear.', 'One sculptural branch or plant beats many small objects.'] },
      bedroom: { furniture: ['bed-queen', 'nightstand', 'wardrobe', 'plant-small'], tips: ['A low platform bed and a simple linen duvet anchor the look.'] },
      dining: { furniture: ['dining-round', 'bench', 'dining-chair'], tips: ['Pair a round wood table with a bench on one side.'] },
      office: { furniture: ['desk', 'office-chair', 'ladder-shelf'], tips: ['Hide cables and paper in closed storage; leave the desk bare.'] },
    },
    ideas: [
      { category: 'Walls', text: 'Limewash walls in warm greige', renterFriendly: false, renterAlt: 'Textured, limewash-look peel-and-stick wallpaper on one wall' },
      { category: 'Lighting', text: 'Paper lantern pendant over the coffee or dining table', renterFriendly: false, renterAlt: 'Paper lantern on a plug-in swag kit hung from a ceiling hook' },
      { category: 'Lighting', text: 'Low rice-paper floor lamp in a corner', renterFriendly: true },
      { category: 'Windows', text: 'Linen or bamboo shades', renterFriendly: false, renterAlt: 'Linen café curtains on tension rods' },
      { category: 'Textiles', text: 'Linen, wool, and boucle in oat, clay, and charcoal', renterFriendly: true },
      { category: 'Storage', text: 'Closed wood sideboard to hide clutter', renterFriendly: true },
      { category: 'Decor', text: 'Handmade ceramics and a single bonsai or olive tree', renterFriendly: true },
    ],
  },
  {
    id: 'midcentury',
    name: 'Mid-century modern',
    tagline: 'Tapered legs, warm walnut, and graphic pops of mustard and teal.',
    palette: { walls: '#f2ede3', floor: '#c49a6c', wood: '#7a4b2a', textile: '#4f6d6a', accents: ['#d9a441', '#c45c3b', '#2e4f5f'] },
    rugPolicy: 'front-legs',
    rugNote: 'Front legs of the sofa and chairs on the rug, with a geometric pattern',
    rooms: {
      living: { furniture: ['sofa-3', 'accent-chair', 'coffee-table', 'sideboard', 'arc-lamp'], tips: ['An arc lamp over the sofa replaces an overhead fixture.', 'Raise pieces on tapered legs to keep the room airy.'] },
      bedroom: { furniture: ['bed-queen', 'nightstand', 'dresser'], tips: ['A long, low walnut dresser doubles as a media surface.'] },
      dining: { furniture: ['dining-round', 'dining-chair', 'bar-cart'], tips: ['A tulip-style round table eases traffic in tight dining nooks.'] },
      office: { furniture: ['desk', 'office-chair', 'bookshelf'], tips: ['A writing desk with slim legs can float facing the room.'] },
    },
    ideas: [
      { category: 'Walls', text: 'Paint a mustard or teal accent wall', renterFriendly: false, renterAlt: 'Large graphic print or a peel-and-stick geometric wallpaper panel' },
      { category: 'Walls', text: 'Wood slat accent panel behind the sofa', renterFriendly: false, renterAlt: 'Freestanding slat room divider or leaning slat panel' },
      { category: 'Lighting', text: 'Sputnik chandelier over the dining table', renterFriendly: false, renterAlt: 'Arc floor lamp reaching over the table' },
      { category: 'Lighting', text: 'Mushroom table lamps on side tables', renterFriendly: true },
      { category: 'Textiles', text: 'Tweed upholstery with burnt-orange and mustard pillows', renterFriendly: true },
      { category: 'Decor', text: 'Starburst clock, ceramic vases, and a snake plant', renterFriendly: true },
      { category: 'Kitchen & bath', text: 'Brass cabinet pulls', renterFriendly: false, renterAlt: 'Swap in brass pulls and store the originals for move-out' },
    ],
  },
  {
    id: 'maximalist',
    name: 'Cozy maximalist',
    tagline: 'Layered pattern, saturated color, collected objects. More is more.',
    palette: { walls: '#5b3a4a', floor: '#8a5a3c', wood: '#5a3622', textile: '#2f5d50', accents: ['#b8452f', '#d4a03c', '#3c4f8a'] },
    rugPolicy: 'layered',
    rugNote: 'A big base rug layered with a smaller patterned or vintage rug on top',
    rooms: {
      living: { furniture: ['sofa-3', 'armchair', 'ottoman', 'coffee-table-round', 'side-table', 'bookshelf', 'floor-lamp', 'plant-large'], tips: ['Mix 3 patterns at different scales: large floral, mid stripe, small geometric.', 'Use five light sources at different heights instead of one overhead.'] },
      bedroom: { furniture: ['bed-queen', 'nightstand', 'chest', 'accent-chair', 'plant-small'], tips: ['A canopy or upholstered headboard is the focal point; go bold on bedding.'] },
      dining: { furniture: ['dining-round', 'dining-chair', 'sideboard', 'bar-cart'], tips: ['Mismatched chairs in one color family look intentional.'] },
      office: { furniture: ['desk', 'accent-chair', 'bookshelf', 'floor-lamp'], tips: ['Floor-to-ceiling books double as color and texture.'] },
    },
    ideas: [
      { category: 'Walls', text: 'Paint walls and trim the same deep jewel tone (color drenching)', renterFriendly: false, renterAlt: 'Patterned peel-and-stick wallpaper and a salon-style gallery wall on strips' },
      { category: 'Walls', text: 'Salon-style gallery wall from floor to ceiling', renterFriendly: true },
      { category: 'Lighting', text: 'Fringed or pleated lampshades on several table lamps', renterFriendly: true },
      { category: 'Lighting', text: 'Statement chandelier', renterFriendly: false, renterAlt: 'Plug-in pendant on a swag hook, plus plug-in picture lights' },
      { category: 'Windows', text: 'Patterned floor-to-ceiling drapes mounted high', renterFriendly: false, renterAlt: 'Floor-length drapes on a tension rod or adhesive brackets' },
      { category: 'Textiles', text: 'Velvet, kilim, and chintz pillows, and a throw on every seat', renterFriendly: true },
      { category: 'Decor', text: 'Display collections on open shelves, grouped in odd numbers', renterFriendly: true },
    ],
  },
  {
    id: 'scandinavian',
    name: 'Scandinavian',
    tagline: 'Bright, airy, functional. Pale wood, white walls, and soft texture.',
    palette: { walls: '#f7f6f2', floor: '#e3d3b8', wood: '#d2b48c', textile: '#c9cfd4', accents: ['#e8e2d6', '#7d9aa6', '#3d4a52'] },
    rugPolicy: 'all-legs',
    rugNote: 'A large, light rug that all furniture legs sit on to unify the room',
    rooms: {
      living: { furniture: ['sofa-3', 'armchair', 'coffee-table', 'side-table', 'floor-lamp', 'plant-large'], tips: ['Keep the palette light and add warmth with wood and wool.', 'Leave negative space; edit to only what you use.'] },
      bedroom: { furniture: ['bed-queen', 'nightstand', 'dresser', 'clothes-rack'], tips: ['White bedding with a chunky knit throw and a sheepskin by the bed.'] },
      dining: { furniture: ['dining-4', 'dining-chair', 'bench'], tips: ['Wishbone-style chairs and a pale oak table keep it light.'] },
      office: { furniture: ['desk', 'office-chair', 'cube-shelf'], tips: ['Pegboard above the desk keeps tools visible but tidy.'] },
    },
    ideas: [
      { category: 'Walls', text: 'Crisp warm-white paint everywhere', renterFriendly: false, renterAlt: 'Most rentals already have white walls: add oversized framed prints' },
      { category: 'Walls', text: 'Wall-mounted pegboard or picture ledges', renterFriendly: false, renterAlt: 'Leaning ladder shelf and a freestanding pegboard easel' },
      { category: 'Lighting', text: 'Simple white pendant over the table', renterFriendly: false, renterAlt: 'Plug-in pendant with fabric cord on a ceiling hook' },
      { category: 'Lighting', text: 'Candles and warm lamps for hygge in the evening', renterFriendly: true },
      { category: 'Windows', text: 'Sheer white curtains to maximize daylight', renterFriendly: true },
      { category: 'Textiles', text: 'Wool throws, sheepskins, and linen in white, gray, and oat', renterFriendly: true },
      { category: 'Decor', text: 'Trailing plants and a few ceramics on a floating shelf', renterFriendly: false, renterAlt: 'Plants on a freestanding plant stand or a tension-pole shelf' },
    ],
  },
  {
    id: 'industrial',
    name: 'Industrial',
    tagline: 'Raw materials: black metal, reclaimed wood, leather, and concrete gray.',
    palette: { walls: '#8a8783', floor: '#6e5a48', wood: '#6b4a32', textile: '#5b4636', accents: ['#9c9a95', '#b5652d', '#1f1f1f'] },
    rugPolicy: 'front-legs',
    rugNote: 'A worn, vintage-style or low-pile rug under the front legs',
    rooms: {
      living: { furniture: ['sofa-3', 'armchair', 'coffee-table', 'tv-stand', 'bookshelf', 'floor-lamp'], tips: ['A leather sofa plus a reclaimed-wood coffee table is the core pairing.', 'Metal-and-wood open shelving reads as industrial instantly.'] },
      bedroom: { furniture: ['bed-queen', 'nightstand', 'clothes-rack', 'chest'], tips: ['An iron bed frame and pipe-style clothing rack double as decor.'] },
      dining: { furniture: ['dining-6', 'bench', 'bar-stool'], tips: ['A long trestle table with a bench on one side seats more in less space.'] },
      office: { furniture: ['desk-large', 'office-chair', 'bookshelf', 'filing'], tips: ['Metal file cabinets as a desk base give an instant workshop look.'] },
    },
    ideas: [
      { category: 'Walls', text: 'Exposed brick or concrete-finish walls', renterFriendly: false, renterAlt: 'Faux-brick or concrete-look peel-and-stick wallpaper' },
      { category: 'Lighting', text: 'Black metal track lighting', renterFriendly: false, renterAlt: 'Plug-in Edison-bulb sconces and a caged floor lamp' },
      { category: 'Lighting', text: 'Exposed-filament bulbs in caged fixtures', renterFriendly: true },
      { category: 'Windows', text: 'Black metal curtain rods with heavy canvas drapes', renterFriendly: false, renterAlt: 'Black tension rods with canvas panels' },
      { category: 'Storage', text: 'Pipe-and-wood wall shelves', renterFriendly: false, renterAlt: 'Freestanding metal-frame bookcase' },
      { category: 'Textiles', text: 'Cognac leather, waxed canvas, and wool in rust and charcoal', renterFriendly: true },
      { category: 'Decor', text: 'Oversized wall clock, vintage maps, and metal accents', renterFriendly: true },
    ],
  },
];

export const PRESETS_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

export function roomSuggestion(presetId: string | null, type: RoomType): RoomSuggestion {
  const preset = presetId ? PRESETS_BY_ID.get(presetId) : undefined;
  return preset?.rooms[type] ?? BASE_ROOM_SUGGESTIONS[type];
}

/** In renter mode: swap in renter alternatives and drop ideas that have none. */
export function visibleIdeas(ideas: Idea[], renterMode: boolean): { text: string; category: IdeaCategory; renterFriendly: boolean }[] {
  if (!renterMode) return ideas;
  return ideas.flatMap((i) => (i.renterFriendly ? [i] : i.renterAlt ? [{ category: i.category, text: i.renterAlt, renterFriendly: true }] : []));
}
