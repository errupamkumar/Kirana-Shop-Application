import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { MAX_CONTENT_WIDTH, useLayout } from '../hooks/useLayout';
import type { Product } from '../lib/types';
import { colors } from '../theme';
import { ProductCard } from './ProductCard';

/** Product grid with 2 columns on phones up to 6 on desktop, infinite scroll and pull to refresh. */
export function ProductGrid({
  products,
  onEndReached,
  loadingMore,
  refreshing,
  onRefresh,
  header,
  empty,
}: {
  products: Product[];
  onEndReached?: () => void;
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  header?: React.ReactElement;
  empty?: React.ReactElement;
}) {
  const layout = useLayout();
  return (
    <FlatList
      // numColumns cannot change on a mounted FlatList; remount when the breakpoint changes
      key={`cols-${layout.productColumns}`}
      data={products}
      numColumns={layout.productColumns}
      keyExtractor={(p) => String(p.id)}
      columnWrapperStyle={{ gap: 12, paddingHorizontal: layout.gutter }}
      contentContainerStyle={{ gap: 12, paddingTop: 12, paddingBottom: 120, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' }}
      renderItem={({ item }) => <ProductCard product={item} width={layout.productCardWidth} />}
      onEndReachedThreshold={0.5}
      onEndReached={onEndReached}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={loadingMore ? <View className="py-4"><ActivityIndicator color={colors.brand} /></View> : undefined}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.brand]} /> : undefined}
      keyboardShouldPersistTaps="handled"
    />
  );
}
