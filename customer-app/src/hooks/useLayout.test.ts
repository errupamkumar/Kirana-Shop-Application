import { categoryVisual } from '../lib/categoryVisuals';
import { computeLayout, MAX_CONTENT_WIDTH } from './useLayout';

describe('responsive layout', () => {
  it.each([
    [360, 2, 4, false],
    [414, 2, 4, false],
    [600, 3, 4, false],
    [768, 4, 6, false],
    [1024, 5, 8, true],
    [1440, 6, 8, true],
  ])('width %i -> %i product columns, %i category columns, wide=%s', (width, products, categories, wide) => {
    const layout = computeLayout(width);
    expect(layout.productColumns).toBe(products);
    expect(layout.categoryColumns).toBe(categories);
    expect(layout.isWide).toBe(wide);
  });

  it('caps the content width on large screens', () => {
    expect(computeLayout(2560).contentWidth).toBe(MAX_CONTENT_WIDTH);
    expect(computeLayout(390).contentWidth).toBe(390);
  });

  it('fits grid cards inside the content column', () => {
    for (const width of [320, 360, 390, 600, 768, 1024, 1440]) {
      const l = computeLayout(width);
      const used = l.productCardWidth * l.productColumns + 12 * (l.productColumns - 1) + l.gutter * 2;
      expect(used).toBeLessThanOrEqual(l.contentWidth);
      expect(l.productCardWidth).toBeGreaterThanOrEqual(130);
    }
  });

  it('shows about two and a half cards in a phone row so it visibly scrolls', () => {
    const l = computeLayout(390);
    expect(l.rowCardWidth * 2.5).toBeLessThanOrEqual(l.contentWidth - l.gutter * 2);
    expect(l.rowCardWidth).toBeGreaterThan(120);
  });
});

describe('category visuals', () => {
  it('matches seeded categories by name or slug', () => {
    expect(categoryVisual('Fruits & Vegetables').emoji).toBe('🥬');
    expect(categoryVisual('dairy-bread-eggs').emoji).toBe('🥛');
    expect(categoryVisual('Atta, Rice & Dal').emoji).toBe('🌾');
    expect(categoryVisual('Cleaning Essentials').emoji).toBe('🧽');
  });

  it('falls back for unknown categories', () => {
    expect(categoryVisual('Stationery').emoji).toBe('🛒');
    expect(categoryVisual(undefined).emoji).toBe('🛒');
  });
});
