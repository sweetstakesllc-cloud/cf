import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { color, type, space, border, formatSEK } from '../theme';
import type { Product } from '../types/product';
import type { RootStackParamList } from '../navigation/types';
import { getFacets, getMatchingDrops } from '../data/mockProducts';
import Chip from '../components/Chip';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// A real build persists these to the user's profile + push registration.
// Sensible defaults so the feed isn't empty on first open.
const DEFAULT_BRANDS = ['Moncler', 'Stone Island'];
const DEFAULT_SIZES = ['M', 'L', 'XL'];

export default function AlertsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [facets, setFacets] = useState<{ brands: string[]; sizes: string[] } | null>(null);
  const [brands, setBrands] = useState<string[]>(DEFAULT_BRANDS);
  const [sizes, setSizes] = useState<string[]>(DEFAULT_SIZES);
  const [drops, setDrops] = useState<Product[] | null>(null);

  useEffect(() => {
    getFacets().then((f) => setFacets({ brands: f.brands, sizes: f.sizes }));
  }, []);

  useEffect(() => {
    setDrops(null);
    getMatchingDrops({ brands, sizes }).then(setDrops);
  }, [brands, sizes]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const following = brands.length > 0 || sizes.length > 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>NEVER MISS A DROP</Text>
          <Text style={styles.hero}>Alerts</Text>
          <Text style={styles.sub}>
            Follow your sizes and brands. We push only the new arrivals that match —
            and one-of-ones go fast.
          </Text>
        </View>

        {/* Follow brands */}
        <Text style={styles.sectionTitle}>FOLLOW BRANDS</Text>
        <View style={styles.chipWrap}>
          {facets?.brands.map((b) => (
            <Chip key={b} label={b} selected={brands.includes(b)} onPress={() => toggle(brands, setBrands, b)} />
          ))}
        </View>

        {/* Follow sizes */}
        <Text style={styles.sectionTitle}>FOLLOW SIZES</Text>
        <View style={styles.chipWrap}>
          {facets?.sizes.map((s) => (
            <Chip key={s} label={s} selected={sizes.includes(s)} onPress={() => toggle(sizes, setSizes, s)} />
          ))}
        </View>

        {/* Matching feed */}
        <View style={styles.feedHead}>
          <Text style={styles.sectionTitle}>MATCHING YOU</Text>
          {!!drops && <Text style={styles.feedCount}>{drops.length} LIVE</Text>}
        </View>

        {!following ? (
          <Hint text="Follow at least one brand or size to start a feed." />
        ) : drops === null ? (
          <View style={styles.loading}>
            <ActivityIndicator color={color.hiVis} />
          </View>
        ) : drops.length === 0 ? (
          <Hint text="Nothing live matches that combination right now. We’ll push you the moment it drops." />
        ) : (
          <View style={styles.feed}>
            {drops.map((p, i) => (
              <DropRow
                key={p.id}
                product={p}
                freshest={i === 0} // top of a newest-first feed wears the one accent
                onPress={() => navigation.navigate('Product', { id: p.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function DropRow({
  product,
  freshest,
  onPress,
}: {
  product: Product;
  freshest: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.drop,
        freshest && styles.dropFresh,
        pressed && styles.dropPressed,
      ]}
    >
      <Image source={{ uri: product.images[0] }} style={styles.dropThumb} resizeMode="cover" />
      <View style={styles.dropBody}>
        {freshest && (
          <View style={styles.freshTag}>
            <Ionicons name="flash" size={11} color={color.onHiVis} />
            <Text style={styles.freshText}>FRESHEST DROP</Text>
          </View>
        )}
        <Text style={styles.dropBrand} numberOfLines={1}>{product.brand}</Text>
        <Text style={styles.dropTitle} numberOfLines={1}>{product.title}</Text>
        <View style={styles.dropMeta}>
          <Text style={styles.dropPrice}>{formatSEK(product.price)}</Text>
          {!!product.size && <Text style={styles.dropSize}>· {product.size}</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color.paperDim} />
    </Pressable>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <View style={styles.hint}>
      <Text style={styles.hintText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },

  header: { paddingHorizontal: space.lg, paddingTop: space.md },
  eyebrow: { ...type.eyebrow, color: color.paperDim },
  hero: { ...type.hero, color: color.paper, marginTop: space.xs },
  sub: { ...type.body, color: color.paperDim, marginTop: space.md },

  sectionTitle: { ...type.eyebrow, color: color.paperDim, paddingHorizontal: space.lg, marginTop: space.xxl, marginBottom: space.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg },

  feedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: space.lg },
  feedCount: { ...type.eyebrow, color: color.paperDim, marginTop: space.xxl, marginBottom: space.md },

  loading: { paddingVertical: space.xxl, alignItems: 'center' },
  feed: { paddingHorizontal: space.lg, gap: space.md },

  drop: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: color.surface, borderWidth: border.hairline, borderColor: color.line,
    padding: space.sm, paddingRight: space.md,
  },
  dropFresh: { borderColor: color.hiVis },
  dropPressed: { opacity: 0.9 },
  dropThumb: { width: 64, height: 78, backgroundColor: color.surfaceAlt },
  dropBody: { flex: 1 },
  freshTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: color.hiVis, paddingHorizontal: 6, paddingVertical: 2, marginBottom: space.xs },
  freshText: { ...type.eyebrow, fontSize: 9, letterSpacing: 1.2, color: color.onHiVis },
  dropBrand: { ...type.eyebrow, color: color.paperDim },
  dropTitle: { ...type.title, fontSize: 13, color: color.paper, marginTop: 2 },
  dropMeta: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, marginTop: space.xs },
  dropPrice: { ...type.price, fontSize: 13, color: color.paper },
  dropSize: { ...type.price, fontSize: 12, color: color.paperDim },

  hint: { marginHorizontal: space.lg, borderWidth: border.hairline, borderColor: color.line, borderStyle: 'dashed', padding: space.lg },
  hintText: { ...type.body, color: color.paperDim },
});
