import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { color, type, space } from '../theme';
import type { Product, ProductFilter } from '../types/product';
import type { RootStackParamList } from '../navigation/types';
import { getNewArrivals, getFacets } from '../data/mockProducts';
import { onMarketChange } from '../data/market';
import ProductCard from '../components/ProductCard';
import TopBar from '../components/TopBar';
import FilterSheet from '../components/FilterSheet';
import FeaturedDrop from '../components/FeaturedDrop';
import BrandRail from '../components/BrandRail';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const GRID_GAP = space.md;
const SIDE = space.lg;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brandCounts, setBrandCounts] = useState<Record<string, number>>({});
  const [totalLive, setTotalLive] = useState(0);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // The website splits browse into BRANDS and CATEGORIES; the app had brands
  // only. Both narrow the same grid and combine, so "Gucci" + "Bags" works.
  const filter = useMemo<ProductFilter | undefined>(() => {
    if (!activeBrand && !activeCategory) return undefined;
    return {
      ...(activeBrand ? { brands: [activeBrand] } : {}),
      ...(activeCategory ? { categories: [activeCategory] } : {}),
    };
  }, [activeBrand, activeCategory]);

  const load = useCallback(async () => {
    const list = await getNewArrivals(filter);
    setProducts(list);
  }, [filter]);

  const loadFacets = useCallback(() => {
    getFacets().then((f) => {
      setBrands(f.brands);
      setCategories(f.categories);
      setBrandCounts(f.brandCounts);
      setTotalLive(f.total);
    });
  }, []);

  useEffect(loadFacets, [loadFacets]);

  // Prices and stock are per-market, so a country switch has to redraw both the
  // grid and the facets that were derived from it.
  useEffect(
    () =>
      onMarketChange(() => {
        setProducts(null);
        load();
        loadFacets();
      }),
    [load, loadFacets]
  );

  useEffect(() => {
    setProducts(null);
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openProduct = useCallback(
    (p: Product) => navigation.navigate('Product', { id: p.id }),
    [navigation]
  );

  // Browse is in-stock only now, so every row in the grid is live.
  const liveCount = products?.length ?? 0;
  const activeCount = (activeCategory ? 1 : 0) + (activeBrand ? 1 : 0);

  // The freshest piece leads. Hidden the moment a filter is on: someone who has
  // narrowed to "Jackets" is hunting, and does not need introducing again.
  const featured = activeCount === 0 ? products?.[0] : undefined;
  const rest = useMemo(
    () => (featured ? (products ?? []).slice(1) : products ?? []),
    [products, featured]
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Live drop + Trustpilot, as across the top of the website */}
      <TopBar />

      {/* Header. The wordmark lives in the bar above; repeating it here just
          pushed the stock down. */}
      <View style={styles.header}>
        <Text style={styles.hero}>New In</Text>
        <View style={styles.countWrap}>
          <Text style={styles.countNum}>{String(liveCount).padStart(2, '0')}</Text>
          <Text style={styles.countLabel}>LIVE</Text>
        </View>
      </View>

      {/* One filter row, the shape the website's collection pages use. */}
      <View style={styles.filterRow}>
        <Pressable
          onPress={() => setFilterOpen(true)}
          style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}
          accessibilityLabel="Filter by category and brand"
        >
          <Ionicons name="options-outline" size={17} color={color.paper} />
          <Text style={styles.filterText}>FILTER</Text>
          {activeCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
          )}
        </Pressable>

        {activeCount > 0 && (
          <Pressable
            onPress={() => {
              setActiveCategory(null);
              setActiveBrand(null);
            }}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Text style={styles.clearText}>CLEAR</Text>
          </Pressable>
        )}
      </View>

      {products === null ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.hiVis} />
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + space.xxxl }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <BrandRail
                brands={brands}
                counts={brandCounts}
                total={totalLive}
                active={activeBrand}
                onPick={setActiveBrand}
              />
              {featured ? <FeaturedDrop product={featured} onPress={openProduct} /> : null}
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <ProductCard product={item} onPress={openProduct} />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nothing matches that filter right now.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.hiVis} />
          }
        />
      )}

      <FilterSheet
        visible={filterOpen}
        categories={categories}
        brands={brands}
        activeCategory={activeCategory}
        activeBrand={activeBrand}
        onPickCategory={setActiveCategory}
        onPickBrand={setActiveBrand}
        onClose={() => setFilterOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: SIDE,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  hero: { ...type.hero, color: color.paper },
  countWrap: { alignItems: 'flex-end' },
  countNum: { ...type.price, fontSize: 22, lineHeight: 24, color: color.hiVis },
  countLabel: { ...type.eyebrow, color: color.paperDim, marginTop: 2 },

  pressed: { opacity: 0.6 },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SIDE, paddingBottom: space.sm,
  },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  filterText: { ...type.eyebrow, color: color.paper },
  filterBadge: {
    minWidth: 16, height: 16, borderRadius: 8, backgroundColor: color.hiVis,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, marginLeft: 2,
  },
  filterBadgeText: { ...type.eyebrow, fontSize: 9, color: color.onHiVis },
  clearText: { ...type.eyebrow, color: color.paperDim, textDecorationLine: 'underline' },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  grid: { paddingHorizontal: SIDE, paddingTop: space.xs },
  row: { gap: GRID_GAP },
  cell: { flex: 1, marginBottom: GRID_GAP },

  empty: { paddingVertical: space.xxxl, alignItems: 'center' },
  emptyText: { ...type.body, color: color.paperDim },
});
