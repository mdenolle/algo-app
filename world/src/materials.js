// Block materials as LEGO colors. Hex values are Rebrickable's official RGB for
// the named color id (same source as catalog/catalog.json), so the world and the
// building app agree on what "green" is. Ids are array indices: append, never reorder.

export const MATERIALS = [
  { id: 0, key: 'grass', name: 'Grass', lego: { id: 2, name: 'Green' }, hex: '237841' },
  { id: 1, key: 'dirt', name: 'Dirt', lego: { id: 70, name: 'Reddish Brown' }, hex: '582A12' },
  { id: 2, key: 'stone', name: 'Stone', lego: { id: 71, name: 'Light Bluish Gray' }, hex: 'A0A5A9' },
  { id: 3, key: 'sand', name: 'Sand', lego: { id: 19, name: 'Tan' }, hex: 'E4CD9E' },
  { id: 4, key: 'snow', name: 'Snow', lego: { id: 15, name: 'White' }, hex: 'F4F4F4' },
  { id: 5, key: 'ice', name: 'Ice', lego: { id: 212, name: 'Bright Light Blue' }, hex: '9FC3E9' },
  { id: 6, key: 'water', name: 'Water', lego: { id: 321, name: 'Dark Azure' }, hex: '078BC9' },
  { id: 7, key: 'wood', name: 'Wood', lego: { id: 84, name: 'Medium Nougat' }, hex: 'AA7D55' },
  { id: 8, key: 'darkstone', name: 'Cobblestone', lego: { id: 72, name: 'Dark Bluish Gray' }, hex: '6C6E68' },
  // Minecraft-style blocks, LEGO colors.
  { id: 9, key: 'planks', name: 'Planks', lego: { id: 28, name: 'Dark Tan' }, hex: '958A73' },
  { id: 10, key: 'log', name: 'Log', lego: { id: 308, name: 'Dark Brown' }, hex: '352100' },
  { id: 11, key: 'leaves', name: 'Leaves', lego: { id: 10, name: 'Bright Green' }, hex: '4B9F4A' },
  { id: 12, key: 'bricks', name: 'Bricks', lego: { id: 320, name: 'Dark Red' }, hex: '720E0F' },
  { id: 13, key: 'glass', name: 'Glass', lego: { id: 47, name: 'Trans-Clear' }, hex: 'FCFCFC', translucent: true },
  { id: 14, key: 'coal', name: 'Coal ore', lego: { id: 0, name: 'Black' }, hex: '05131D', ore: true },
  { id: 15, key: 'iron', name: 'Iron ore', lego: { id: 179, name: 'Flat Silver' }, hex: '898788', ore: true },
  { id: 16, key: 'gold', name: 'Gold', lego: { id: 14, name: 'Yellow' }, hex: 'F2CD37', ore: true },
  { id: 17, key: 'diamond', name: 'Diamond', lego: { id: 322, name: 'Medium Azure' }, hex: '36AEBF', ore: true },
  { id: 18, key: 'emerald', name: 'Emerald', lego: { id: 27, name: 'Lime' }, hex: 'BBE90B', ore: true },
  { id: 19, key: 'redstone', name: 'Redstone', lego: { id: 4, name: 'Red' }, hex: 'C91A09', ore: true },
  { id: 20, key: 'lapis', name: 'Lapis', lego: { id: 1, name: 'Blue' }, hex: '0055BF', ore: true },
  { id: 21, key: 'obsidian', name: 'Obsidian', lego: { id: 85, name: 'Dark Purple' }, hex: '3F3691', ore: true },
  { id: 22, key: 'tnt', name: 'TNT', lego: { id: 25, name: 'Orange' }, hex: 'FE8A18' },
  { id: 23, key: 'pink', name: 'Pink block', lego: { id: 29, name: 'Bright Pink' }, hex: 'E4ADC8' },
  { id: 24, key: 'purple', name: 'Purple block', lego: { id: 30, name: 'Medium Lavender' }, hex: 'AC78BA' },
  { id: 25, key: 'glowstone', name: 'Glowstone', lego: { id: 226, name: 'Bright Light Yellow' }, hex: 'FFF03A', glow: true },
];

export const MATERIAL = Object.fromEntries(MATERIALS.map(m => [m.key, m.id]));

/** Linear RGB triplets (0..1) indexed by material id, for instance colors. */
export const MATERIAL_RGB = MATERIALS.map(m => {
  const n = parseInt(m.hex, 16);
  const srgb = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  // three.js expects linear color values; convert from sRGB.
  return srgb.map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
});

export const isTranslucent = id => Boolean(MATERIALS[id]?.translucent);
