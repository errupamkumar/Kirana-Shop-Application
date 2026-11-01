import { Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { CartBar } from '../components/CartBar';
import { ProductGrid } from '../components/ProductGrid';
import { Container } from '../components/Screen';
import { EmptyView, ErrorView, SkeletonGrid } from '../components/ui';
import { useDebounced, useProducts } from '../hooks/queries';
import { useLayout } from '../hooks/useLayout';
import { useT } from '../i18n';
import { errorMessage } from '../lib/api';
import { colors } from '../theme';

export function SearchScreen() {
  const layout = useLayout();
  const t = useT();
  const suggestions = t('search.suggestions').split(',');
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 300);
  const query = useProducts(undefined, q);
  const products = query.data?.pages.flatMap((p) => p.content) ?? [];

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 py-3">
        <Container className="h-12 flex-row items-center rounded-xl bg-gray-100 px-3">
          <Search size={20} color={colors.muted} />
          <TextInput
            accessibilityLabel={t('home.search')}
            value={text}
            onChangeText={setText}
            placeholder={t('home.searchHint')}
            placeholderTextColor={colors.muted}
            autoFocus
            returnKeyType="search"
            className="ml-2 h-full flex-1 text-base text-gray-900"
          />
          {text.length > 0 && (
            <Pressable accessibilityRole="button" accessibilityLabel={t('search.clear')} hitSlop={8} onPress={() => setText('')}>
              <X size={18} color={colors.inkSoft} />
            </Pressable>
          )}
        </Container>
      </View>

      {q.length < 2 ? (
        <Container className="px-4 pt-5">
          <Text className="mb-3 font-bold text-gray-900">{t('search.popular')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {suggestions.map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                onPress={() => setText(s)}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 active:bg-gray-100"
              >
                <Text className="font-semibold text-gray-700">{s}</Text>
              </Pressable>
            ))}
          </View>
        </Container>
      ) : query.error ? (
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
          empty={<EmptyView emoji="🔍" title={t('search.noResults', { q })} message={t('search.noResultsBody')} />}
        />
      )}
      <CartBar />
    </View>
  );
}
