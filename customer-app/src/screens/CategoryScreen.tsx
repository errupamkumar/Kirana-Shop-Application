import { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { CartBar } from '../components/CartBar';
import { ProductGrid } from '../components/ProductGrid';
import { Container } from '../components/Screen';
import { EmptyView, ErrorView, SkeletonGrid } from '../components/ui';
import { useProducts } from '../hooks/queries';
import { useLayout } from '../hooks/useLayout';
import { useT } from '../i18n';
import { errorMessage } from '../lib/api';
import { categoryVisual } from '../lib/categoryVisuals';
import type { AppScreenProps } from '../navigation/types';

export function CategoryScreen({ route, navigation }: AppScreenProps<'Category'>) {
  const { categoryId, name } = route.params;
  const layout = useLayout();
  const t = useT();
  const query = useProducts(categoryId);
  const products = query.data?.pages.flatMap((p) => p.content) ?? [];

  useLayoutEffect(() => {
    navigation.setOptions({ title: name ?? t('category.title') });
  }, [navigation, name, t]);

  return (
    <View className="flex-1 bg-gray-50">
      {query.error ? (
        <ErrorView message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <Container>
          <SkeletonGrid count={layout.productColumns * 2} cardWidth={layout.productCardWidth} />
        </Container>
      ) : (
        <ProductGrid
          products={products}
          onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage()}
          loadingMore={query.isFetchingNextPage}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          empty={<EmptyView emoji={categoryVisual(name).emoji} title={t('category.emptyTitle')} message={t('category.emptyBody')} />}
        />
      )}
      <CartBar />
    </View>
  );
}
