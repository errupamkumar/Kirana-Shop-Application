/** Illustration and tint per category, used until the store uploads real images. */
export interface CategoryVisual {
  emoji: string;
  tint: string;
}

const BY_KEYWORD: [RegExp, CategoryVisual][] = [
  [/fruit|veg/i, { emoji: '🥬', tint: '#e8f7e4' }],
  [/dairy|milk|bread|egg/i, { emoji: '🥛', tint: '#eaf3ff' }],
  [/atta|rice|dal|flour|grain/i, { emoji: '🌾', tint: '#fdf3dc' }],
  [/oil|ghee|masala|spice/i, { emoji: '🫙', tint: '#fff0e0' }],
  [/snack|biscuit|namkeen|chips/i, { emoji: '🍪', tint: '#fbeee6' }],
  [/drink|juice|beverage|water/i, { emoji: '🧃', tint: '#fff4d6' }],
  [/personal|care|beauty|bath/i, { emoji: '🧴', tint: '#f3ecff' }],
  [/clean|home|detergent|household/i, { emoji: '🧽', tint: '#e6f6f7' }],
  [/baby/i, { emoji: '🍼', tint: '#fdeef3' }],
  [/frozen|ice/i, { emoji: '🧊', tint: '#e8f4fb' }],
  [/sweet|chocolate/i, { emoji: '🍫', tint: '#f6ebe4' }],
];

const FALLBACK: CategoryVisual = { emoji: '🛒', tint: '#eef2f6' };

/** Matches on the category name or slug, so new categories get a sensible look automatically. */
export function categoryVisual(nameOrSlug: string | null | undefined): CategoryVisual {
  if (!nameOrSlug) return FALLBACK;
  return BY_KEYWORD.find(([pattern]) => pattern.test(nameOrSlug))?.[1] ?? FALLBACK;
}
