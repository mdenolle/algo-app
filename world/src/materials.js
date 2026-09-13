// Terrain materials as LEGO colors. Hex values are Rebrickable's official RGB for
// the named color id (same source as catalog/catalog.json), so the world and the
// building app agree on what "green" is.

export const MATERIALS = [
  { id: 0, key: 'grass', name: 'Grass', lego: { id: 2, name: 'Green' }, hex: '237841' },
  { id: 1, key: 'dirt', name: 'Dirt', lego: { id: 70, name: 'Reddish Brown' }, hex: '582A12' },
  { id: 2, key: 'stone', name: 'Stone', lego: { id: 71, name: 'Light Bluish Gray' }, hex: 'A0A5A9' },
  { id: 3, key: 'sand', name: 'Sand', lego: { id: 19, name: 'Tan' }, hex: 'E4CD9E' },
  { id: 4, key: 'snow', name: 'Snow', lego: { id: 15, name: 'White' }, hex: 'F4F4F4' },
  { id: 5, key: 'ice', name: 'Ice', lego: { id: 212, name: 'Bright Light Blue' }, hex: '9FC3E9' },
  { id: 6, key: 'water', name: 'Water', lego: { id: 321, name: 'Dark Azure' }, hex: '078BC9' },
  { id: 7, key: 'wood', name: 'Wood', lego: { id: 84, name: 'Medium Nougat' }, hex: 'AA7D55' },
  { id: 8, key: 'darkstone', name: 'Dark stone', lego: { id: 72, name: 'Dark Bluish Gray' }, hex: '6C6E68' },
];

export const MATERIAL = Object.fromEntries(MATERIALS.map(m => [m.key, m.id]));

/** Linear RGB triplets (0..1) indexed by material id, for instance colors. */
export const MATERIAL_RGB = MATERIALS.map(m => {
  const n = parseInt(m.hex, 16);
  const srgb = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  // three.js expects linear color values; convert from sRGB.
  return srgb.map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
});
