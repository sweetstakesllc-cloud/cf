import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { color, type, space } from '../theme';
import type { Product, ProductFilter } from '../types/product';
import type { RootStackParamList } from '../navigation/types';
import { getNewArrivals, getFacets } from '../data/mockProducts';
import { onMarketChange } from '../data/market';
import ProductCard from '../components/ProductCard';
import Chip from '../components/Chip';
import TopBar from '../components/TopBar';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const GRID_GAP = space.md;
const SIDE = space.lg;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Live drop + Trustpilot, as across the top of the website */}
      <TopBar />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>CIRCULAR FASH</Text>
          <Text style={styles.hero}>New In</Text>
        </View>
        <View style={styles.countWrap}>
          <Text style={styles.countNum}>{String(liveCount).padStart(2, '0')}</Text>
          <Text style={styles.countLabel}>LIVE</Text>
        </View>
      </View>

      {/* Category chips */}
      {categories.length > 0 && (
        <>
          <Text style={styles.facetLabel}>CATEGORIES</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            style={styles.chipScroll}
            keyboardShouldPersistTaps="handled"
          >
            <Chip
              label="All"
              selected={activeCategory === null}
              onPress={() => setActiveCategory(null)}
            />
            {categories.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={activeCategory === c}
                onPress={() => setActiveCategory((cur) => (cur === c ? null : c))}
              />
            ))}
          </ScrollView>
        </>
      )}

      {/* Brand chips */}
      <Text style={styles.facetLabel}>BRANDS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroll}
        keyboardShouldPersistTaps="handled"
      >
        <Chip label="All" selected={activeBrand === null} onPress={() => setActiveBrand(null)} />
        {brands.map((b) => (
          <Chip
            key={b}
            label={b}
            selected={activeBrand === b}
            onPress={() => setActiveBrand((cur) => (cur === b ? null : b))}
          />
        ))}
      </ScrollView>

      {products === null ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.hiVis} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + space.xxxl }]}
          showsVerticalScrollIndicator={false}
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
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  eyebrow: { ...type.eyebrow, color: color.paperDim },
  hero: { ...type.hero, color: color.paper, marginTop: space.xs },
  countWrap: { alignItems: 'flex-end' },
  countNum: { ...type.price, fontSize: 22, lineHeight: 24, color: color.hiVis },
  countLabel: { ...type.eyebrow, color: color.paperDim, marginTop: 2 },

  // Fixed height + no shrink: a horizontal ScrollView can't derive its height
  // from horizontally-scrolling content on web (react-native-web), so without
  // this the whole chip row collapses to a sliver. Chip ≈ 32px; 48 leaves air.
  chipScroll: { flexGrow: 0, flexShrink: 0, height: 44, marginBottom: space.xs },
  facetLabel: { ...type.eyebrow, color: color.paperMute, paddingHorizontal: SIDE, marginBottom: space.xs },
  chips: { paddingHorizontal: SIDE, gap: space.sm, alignItems: 'center' },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  grid: { paddingHorizontal: SIDE, paddingTop: space.xs },
  row: { gap: GRID_GAP },
  cell: { flex: 1, marginBottom: GRID_GAP },

  empty: { paddingVertical: space.xxxl, alignItems: 'center' },
  emptyText: { ...type.body, color: color.paperDim },
});
