import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCategoryName } from '../hooks/queries';
import { localName, useLang, useT } from '../i18n';
import { formatPrice } from '../lib/money';
import type { Product } from '../lib/types';
import { useCartStore, useQty } from '../store/cart';
import { ProductImage } from './ProductImage';
import { QtyStepper } from './QtyStepper';

/** Blinkit-style card: image, discount badge, name, variant chips, price with struck MRP, ADD / stepper. */
export function ProductCard({ product, width }: { product: Product; width: number }) {
  const firstInStock = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstInStock?.id);
  const variant = product.variants.find((v) => v.id === variantId) ?? firstInStock;
  const qty = useQty(variant?.id ?? -1);
  const categoryName = useCategoryName(product.categoryId);
  const add = useCartStore((s) => s.add);
  const increment = useCartStore((s) => s.increment);
  const decrement = useCartStore((s) => s.decrement);
  const t = useT();
  const lang = useLang();

  if (!variant) return null;
  const name = localName(product, lang);
  const label = `${name} ${variant.label}`;
  const outOfStock = !variant.inStock;

  return (
    <View style={{ width }} className="rounded-2xl border border-gray-100 bg-white p-2.5">
      <View className={`items-center ${outOfStock ? 'opacity-50' : ''}`}>
        <ProductImage url={product.imageUrl} name={name} size={width - 22} category={categoryName} />
        {variant.discountPercent > 0 && (
          <View className="absolute left-0 top-0 rounded-md bg-blue-600 px-1.5 py-0.5">
            <Text className="text-[10px] font-extrabold text-white">{t('product.off', { percent: variant.discountPercent })}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={2} className="mt-2 min-h-[36px] text-[13px] font-semibold leading-[18px] text-gray-900">
        {name}
      </Text>
      <Text numberOfLines={1} className="min-h-[15px] text-[11px] text-gray-500">
        {product.brand ?? ''}
      </Text>

      {product.variants.length > 1 ? (
        <View className="mt-1.5 min-h-[22px] flex-row flex-wrap gap-1">
          {product.variants.map((v) => {
            const selected = v.id === variant.id;
            return (
              <Pressable
                key={v.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${name} ${v.label}`}
                onPress={() => setVariantId(v.id)}
                className={`rounded-md border px-1.5 py-0.5 ${selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}
              >
                <Text className={`text-[11px] ${selected ? 'font-bold text-brand-700' : 'text-gray-600'}`}>{v.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text className="mt-1.5 min-h-[22px] text-[11px] text-gray-500">{variant.label}</Text>
      )}

      <View className="mt-2 flex-row items-end justify-between">
        <View>
          <Text className="text-[14px] font-extrabold text-gray-900">{formatPrice(variant.sellingPrice)}</Text>
          {variant.mrp > variant.sellingPrice ? (
            <Text className="text-[11px] text-gray-400 line-through">{formatPrice(variant.mrp)}</Text>
          ) : (
            <Text className="text-[11px]"> </Text>
          )}
        </View>
        {outOfStock ? (
          <View className="h-[34px] justify-center">
            <Text className="text-[11px] font-bold text-gray-400">{t('product.outOfStock')}</Text>
          </View>
        ) : qty > 0 ? (
          <QtyStepper compact qty={qty} label={label} onIncrement={() => increment(variant.id)} onDecrement={() => decrement(variant.id)} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('product.addA11y', { label })}
            onPress={() =>
              add({
                variantId: variant.id,
                productId: product.id,
                productName: product.name,
                productNameHi: product.nameHi ?? null,
                variantLabel: variant.label,
                imageUrl: product.imageUrl,
                sellingPrice: variant.sellingPrice,
                mrp: variant.mrp,
              })
            }
            className="h-[34px] min-w-[70px] items-center justify-center rounded-lg border border-brand-500 bg-brand-50 px-3 active:bg-brand-100"
          >
            <Text className="text-[13px] font-extrabold text-brand-600">{t('product.add')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
