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
import ProductCard from '../components/ProductCard';
import Chip from '../components/Chip';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const GRID_GAP = space.md;
const SIDE = space.lg;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filter = useMemo<ProductFilter | undefined>(
    () => (activeBrand ? { brands: [activeBrand] } : undefined),
    [activeBrand]
  );

  const load = useCallback(async () => {
    const list = await getNewArrivals(filter);
    setProducts(list);
  }, [filter]);

  useEffect(() => {
    getFacets().then((f) => setBrands(f.brands));
  }, []);

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

  const liveCount = products?.filter((p) => p.availableForSale).length ?? 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
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

      {/* Brand filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroll}
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

  chipScroll: { flexGrow: 0 },
  chips: { paddingHorizontal: SIDE, gap: space.sm, paddingBottom: space.md },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  grid: { paddingHorizontal: SIDE, paddingTop: space.xs },
  row: { gap: GRID_GAP },
  cell: { flex: 1, marginBottom: GRID_GAP },

  empty: { paddingVertical: space.xxxl, alignItems: 'center' },
  emptyText: { ...type.body, color: color.paperDim },
});
