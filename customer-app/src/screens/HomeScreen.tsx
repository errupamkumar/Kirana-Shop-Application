import { useNavigation } from '@react-navigation/native';
import { ChevronDown, ChevronRight, MapPin, Search, Truck, UserRound } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ServiceabilityBanner, StoreClosedBanner } from '../components/Banners';
import { CartBar } from '../components/CartBar';
import { ProductCard } from '../components/ProductCard';
import { ProductImage } from '../components/ProductImage';
import { Container } from '../components/Screen';
import { ErrorView, Skeleton } from '../components/ui';
import { useAddresses, useCatalog, useStoreConfig } from '../hooks/queries';
import { useLayout, type Layout } from '../hooks/useLayout';
import { recheckLocation } from '../hooks/useServiceability';
import { errorMessage } from '../lib/api';
import { formatPrice } from '../lib/money';
import type { Category, StoreConfig } from '../lib/types';
import { useCheckoutStore } from '../store/session';
import { colors } from '../theme';

function CategoryGrid({ categories, layout }: { categories: Category[]; layout: Layout }) {
  const navigation = useNavigation();
  const gap = 10;
  const tile = Math.floor((layout.contentWidth - layout.gutter * 2 - gap * (layout.categoryColumns - 1)) / layout.categoryColumns);
  return (
    <View className="flex-row flex-wrap" style={{ gap }}>
      {categories.map((c) => (
        <Pressable
          key={c.id}
          accessibilityRole="button"
          accessibilityLabel={c.name}
          onPress={() => navigation.navigate('Category', { categoryId: c.id, name: c.name })}
          style={{ width: tile }}
          className="items-center active:opacity-70"
        >
          <ProductImage url={c.imageUrl} name={c.name} size={tile} category={c.slug} />
          <Text numberOfLines={2} className="mt-1.5 text-center text-[12px] font-semibold leading-4 text-gray-800">
            {c.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Store promise strip: free-delivery threshold and minimum order, straight from the live store settings. */
function PromiseStrip({ config }: { config: StoreConfig }) {
  return (
    <View className="mt-3 flex-row items-center rounded-2xl bg-white p-3" style={{ borderWidth: 1, borderColor: colors.line }}>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
        <Truck size={20} color={colors.brand} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="font-bold text-gray-900">
          {config.freeDeliveryAbove != null ? `Free delivery above ${formatPrice(config.freeDeliveryAbove)}` : `Delivery ${formatPrice(config.deliveryCharge)}`}
        </Text>
        <Text className="text-xs text-gray-600">
          Minimum order {formatPrice(config.minOrderAmount)} · delivering within {config.maxDeliveryRadiusKm} km
        </Text>
      </View>
    </View>
  );
}

function HomeSkeleton({ layout }: { layout: Layout }) {
  return (
    <View className="mt-5 gap-4">
      <Skeleton className="h-6 w-40" />
      <View className="flex-row flex-wrap gap-2.5">
        {Array.from({ length: layout.categoryColumns }, (_, i) => (
          <Skeleton key={i} style={{ width: (layout.contentWidth - 32 - 10 * (layout.categoryColumns - 1)) / layout.categoryColumns, height: 90 }} />
        ))}
      </View>
      <Skeleton className="h-6 w-48" />
      <View className="flex-row gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} style={{ width: layout.rowCardWidth, height: 250 }} />
        ))}
      </View>
    </View>
  );
}

export function HomeScreen() {
  const navigation = useNavigation();
  const layout = useLayout();
  const config = useStoreConfig();
  const catalog = useCatalog();
  const addresses = useAddresses();
  const selectedId = useCheckoutStore((s) => s.addressId);
  const address = addresses.data?.find((a) => a.id === selectedId) ?? addresses.data?.find((a) => a.isDefault);

  const refreshing = catalog.isRefetching || config.isRefetching;
  const onRefresh = () => {
    void catalog.refetch();
    void config.refetch();
    void addresses.refetch();
    void recheckLocation();
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: colors.accent }}>
      <ScrollView
        className="bg-gray-50"
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.brand]} />}
      >
        {/* 0: header */}
        <View className="bg-accent px-4 pb-2 pt-3">
          <Container className="flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Choose delivery address"
              onPress={() => navigation.navigate('Addresses', { select: true })}
              className="mr-3 flex-1 active:opacity-70"
            >
              <Text className="text-[11px] font-extrabold uppercase tracking-wide text-gray-800">{config.data?.storeName ?? 'Kirana'}</Text>
              <View className="mt-0.5 flex-row items-center">
                <MapPin size={16} color={colors.ink} />
                <Text numberOfLines={1} className="ml-1 flex-shrink text-[17px] font-extrabold text-gray-900">
                  {address ? `${address.label} · ${address.line1}` : 'Add delivery address'}
                </Text>
                <ChevronDown size={18} color={colors.ink} />
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Your profile"
              onPress={() => navigation.navigate('Profile')}
              className="h-10 w-10 items-center justify-center rounded-full bg-white active:opacity-70"
            >
              <UserRound size={20} color={colors.ink} />
            </Pressable>
          </Container>
        </View>

        {/* 1: sticky search */}
        <View className="bg-accent px-4 pb-3">
          <Container>
            <Pressable
              accessibilityRole="search"
              accessibilityLabel="Search products"
              onPress={() => navigation.navigate('Search')}
              className="h-12 flex-row items-center rounded-xl bg-white px-3 active:opacity-80"
            >
              <Search size={20} color={colors.muted} />
              <Text className="ml-2 text-gray-400">Search &quot;atta&quot;, &quot;milk&quot;, &quot;rice&quot;</Text>
            </Pressable>
          </Container>
        </View>

        <Container className="px-4">
          <StoreClosedBanner config={config.data} />
          <ServiceabilityBanner />
          {config.data && <PromiseStrip config={config.data} />}

          {catalog.error ? (
            <ErrorView message={errorMessage(catalog.error)} onRetry={() => void catalog.refetch()} />
          ) : !catalog.data ? (
            <HomeSkeleton layout={layout} />
          ) : (
            <>
              <Text accessibilityRole="header" className="mb-3 mt-6 text-lg font-extrabold text-gray-900">
                Shop by category
              </Text>
              <CategoryGrid categories={catalog.data.categories} layout={layout} />
              {catalog.data.sections.map((section) => (
                <View key={section.category.id} className="mt-7">
                  <View className="mb-3 flex-row items-center justify-between">
                    <Text accessibilityRole="header" className="text-lg font-extrabold text-gray-900">
                      {section.category.name}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`See all ${section.category.name}`}
                      onPress={() => navigation.navigate('Category', { categoryId: section.category.id, name: section.category.name })}
                      className="flex-row items-center active:opacity-60"
                    >
                      <Text className="font-bold text-brand-600">See all</Text>
                      <ChevronRight size={16} color={colors.brandDark} />
                    </Pressable>
                  </View>
                  <FlatList
                    horizontal
                    data={section.products}
                    keyExtractor={(p) => String(p.id)}
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -layout.gutter }}
                    contentContainerStyle={{ paddingHorizontal: layout.gutter, gap: 12 }}
                    renderItem={({ item }) => <ProductCard product={item} width={layout.rowCardWidth} />}
                  />
                </View>
              ))}
            </>
          )}
        </Container>
      </ScrollView>
      <CartBar />
    </SafeAreaView>
  );
}
