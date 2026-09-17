// Tools and weapons: what they can break, how hard they hit, and how to make them.
// Pure data and functions, so the rules can be tested and tuned.

import { hardnessOf, TIER_NAMES } from './materials.js';

export const TOOLS = {
  woodPickaxe: { label: 'Wooden pickaxe', tool: 'pickaxe', tier: 1, power: 2, emoji: '⛏️', hex: '#958A73' },
  stonePickaxe: { label: 'Stone pickaxe', tool: 'pickaxe', tier: 2, power: 3, emoji: '⛏️', hex: '#A0A5A9' },
  ironPickaxe: { label: 'Iron pickaxe', tool: 'pickaxe', tier: 3, power: 4, emoji: '⛏️', hex: '#898788' },
  diamondPickaxe: { label: 'Diamond pickaxe', tool: 'pickaxe', tier: 4, power: 6, emoji: '⛏️', hex: '#36AEBF' },
  woodSword: { label: 'Wooden sword', tool: 'sword', damage: 2, emoji: '🗡️', hex: '#958A73' },
  stoneSword: { label: 'Stone sword', tool: 'sword', damage: 3, emoji: '🗡️', hex: '#A0A5A9' },
  ironSword: { label: 'Iron sword', tool: 'sword', damage: 4, emoji: '🗡️', hex: '#898788' },
  diamondSword: { label: 'Diamond sword', tool: 'sword', damage: 6, emoji: '🗡️', hex: '#36AEBF' },
};

/** What it takes to make each tool (and planks from wood). */
export const RECIPES = [
  { makes: 'planks', count: 4, needs: { log: 1 } },
  { makes: 'planks', count: 4, needs: { wood: 1 } },
  { makes: 'woodPickaxe', count: 1, needs: { planks: 5 } },
  { makes: 'stonePickaxe', count: 1, needs: { stone: 3, planks: 2 } },
  { makes: 'ironPickaxe', count: 1, needs: { iron: 3, planks: 2 } },
  { makes: 'diamondPickaxe', count: 1, needs: { diamond: 3, planks: 2 } },
  { makes: 'woodSword', count: 1, needs: { planks: 4 } },
  { makes: 'stoneSword', count: 1, needs: { stone: 2, planks: 2 } },
  { makes: 'ironSword', count: 1, needs: { iron: 2, planks: 2 } },
  { makes: 'diamondSword', count: 1, needs: { diamond: 2, planks: 2 } },
];

export function canCraft(recipe, inventory) {
  return Object.entries(recipe.needs).every(([key, n]) => (inventory[key] ?? 0) >= n);
}

/** Returns the new inventory, or null if the ingredients are missing. */
export function craft(recipe, inventory) {
  if (!canCraft(recipe, inventory)) return null;
  const next = { ...inventory };
  for (const [key, n] of Object.entries(recipe.needs)) next[key] -= n;
  next[recipe.makes] = (next[recipe.makes] ?? 0) + recipe.count;
  return next;
}

/**
 * One hit on a block with the selected item. Returns { allowed, power, hardness, needs }:
 * allowed is false when the block needs a better pickaxe (or cannot be broken at all).
 */
export function hitBlock(material, selectedKey) {
  const { hardness, tier } = hardnessOf(material);
  const tool = TOOLS[selectedKey];
  const toolTier = tool?.tool === 'pickaxe' ? tool.tier : 0;
  const power = tool?.tool === 'pickaxe' ? tool.power : 1;
  if (!Number.isFinite(hardness)) return { allowed: false, power: 0, hardness, needs: null };
  if (tier > toolTier) return { allowed: false, power: 0, hardness, needs: TIER_NAMES[tier] };
  return { allowed: true, power, hardness, needs: null };
}

/** Hearts of damage a hit does to a mob with the selected item. */
export function hitDamage(selectedKey) {
  const tool = TOOLS[selectedKey];
  return tool?.tool === 'sword' ? tool.damage : 1;
}
