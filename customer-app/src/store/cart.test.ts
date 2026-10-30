import { itemCount, itemSubtotal, MAX_QTY_PER_ITEM, mrpSavings, useCartStore } from './cart';

const atta = {
  variantId: 17,
  productId: 12,
  productName: 'Whole Wheat Atta',
  variantLabel: '5 kg',
  imageUrl: null,
  sellingPrice: 259,
  mrp: 295,
};
const milk = { ...atta, variantId: 8, productId: 6, productName: 'Toned Milk', variantLabel: '500 ml', sellingPrice: 26, mrp: 26 };
const odd = { ...atta, variantId: 99, productId: 99, productName: 'Paise item', sellingPrice: 33.33, mrp: 40 };

const cart = () => useCartStore.getState();

beforeEach(() => cart().clear());

describe('cart store', () => {
  it('adds an item with qty 1 and increments on repeat add', () => {
    cart().add(atta);
    expect(cart().items[17].qty).toBe(1);
    cart().add(atta);
    expect(cart().items[17].qty).toBe(2);
  });

  it('increments, decrements and removes at zero', () => {
    cart().add(milk);
    cart().increment(8);
    cart().increment(8);
    expect(cart().items[8].qty).toBe(3);
    cart().decrement(8);
    cart().decrement(8);
    cart().decrement(8);
    expect(cart().items[8]).toBeUndefined();
  });

  it('caps quantity per item', () => {
    cart().add(milk);
    for (let i = 0; i < 60; i++) cart().increment(8);
    expect(cart().items[8].qty).toBe(MAX_QTY_PER_ITEM);
  });

  it('removes an item and clears the cart', () => {
    cart().add(milk);
    cart().add(atta);
    cart().remove(8);
    expect(Object.keys(cart().items)).toEqual(['17']);
    cart().clear();
    expect(cart().items).toEqual({});
  });

  it('ignores actions for items not in the cart', () => {
    const before = cart().items;
    cart().increment(123);
    cart().decrement(123);
    expect(cart().items).toBe(before);
  });

  it('derives item count, subtotal and MRP savings', () => {
    cart().add(atta); // 259
    cart().add(atta); // 518
    cart().add(milk); // 26
    expect(itemCount(cart().items)).toBe(3);
    expect(itemSubtotal(cart().items)).toBe(544);
    expect(mrpSavings(cart().items)).toBe(72);
  });

  it('adds paise without floating point drift', () => {
    cart().add(odd);
    cart().increment(99);
    cart().increment(99);
    expect(itemSubtotal(cart().items)).toBe(99.99);
  });

  it('syncs prices from a server quote', () => {
    cart().add(atta);
    cart().syncPrices([{ variantId: 17, sellingPrice: 249, mrp: 295 }]);
    expect(cart().items[17].sellingPrice).toBe(249);
    // Unknown lines (null prices) leave the cart untouched
    const before = cart().items;
    cart().syncPrices([{ variantId: 17, sellingPrice: null, mrp: null }]);
    expect(cart().items).toBe(before);
  });
});
