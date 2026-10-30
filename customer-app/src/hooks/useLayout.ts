import { useWindowDimensions } from 'react-native';

/** Content never grows wider than this on large screens (desktop browser, landscape tablet). */
export const MAX_CONTENT_WIDTH = 1200;
const GUTTER = 16;

export interface Layout {
  /** Full window width. */
  width: number;
  /** Width of the centred content column. */
  contentWidth: number;
  /** Tablet / desktop: two-pane screens (cart, order detail). */
  isWide: boolean;
  /** Columns for product grids. */
  productColumns: number;
  /** Width of one card in a product grid. */
  productCardWidth: number;
  /** Width of a card in a horizontal product row. */
  rowCardWidth: number;
  /** Columns for the category grid. */
  categoryColumns: number;
  gutter: number;
}

/** Pure breakpoint maths, so it can be unit tested. */
export function computeLayout(width: number): Layout {
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
  const inner = contentWidth - GUTTER * 2;
  const productColumns = contentWidth >= 1100 ? 6 : contentWidth >= 900 ? 5 : contentWidth >= 700 ? 4 : contentWidth >= 520 ? 3 : 2;
  const categoryColumns = contentWidth >= 1000 ? 8 : contentWidth >= 640 ? 6 : 4;
  const gap = 12;
  return {
    width,
    contentWidth,
    isWide: contentWidth >= 900,
    productColumns,
    productCardWidth: Math.floor((inner - gap * (productColumns - 1)) / productColumns),
    // Phones show about 2.5 cards so the row visibly scrolls; larger screens use a fixed comfortable size
    rowCardWidth: contentWidth < 520 ? Math.floor((inner - gap * 2) / 2.5) : 168,
    categoryColumns,
    gutter: GUTTER,
  };
}

/** Responsive breakpoints for phones, tablets and the desktop browser build. */
export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  return computeLayout(width);
}
