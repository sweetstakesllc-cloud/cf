import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { color, type, space, border, formatMoney } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { getSaved, type SavedItem, type SavedStatus } from '../data/mockProducts';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_COPY: Record<SavedStatus, string> = {
  available: 'STILL AVAILABLE',
  viewing: 'VIEWING NOW',
  sold: 'JUST SOLD',
};

export default function SavedScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<SavedItem[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getSaved().then((data) => {
        if (alive) setItems(data);
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  const liveCount = items?.filter((i) => i.status !== 'sold').length ?? 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>YOUR LIST</Text>
          <Text style={styles.hero}>Saved</Text>
        </View>
        <View style={styles.countWrap}>
          <Text style={styles.countNum}>{String(liveCount).padStart(2, '0')}</Text>
          <Text style={styles.countLabel}>STILL UP</Text>
        </View>
      </View>

      {items === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.hiVis} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.product.id}
          contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxxl, gap: space.md }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nothing saved yet. Tap the bookmark on a piece to track it.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <SavedRow
              item={item}
              onPress={() => navigation.navigate('Product', { id: item.product.id })}
            />
          )}
        />
      )}
    </View>
  );
}

function SavedRow({ item, onPress }: { item: SavedItem; onPress: () => void }) {
  const { product, status, viewers } = item;
  const sold = status === 'sold';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.thumbWell}>
        <Image
          source={{ uri: product.images[0] }}
          style={[styles.thumb, sold && styles.thumbSold]}
          resizeMode="cover"
        />
        {sold && (
          <View style={styles.soldOverlay} pointerEvents="none">
            <Text style={styles.soldStamp}>SOLD</Text>
          </View>
        )}
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.brand} numberOfLines={1}>{product.brand}</Text>
        <Text style={styles.title} numberOfLines={2}>{product.title}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.price}>{formatMoney(product.price, product.currencyCode)}</Text>
          {!!product.size && <Text style={styles.size}>· {product.size}</Text>}
        </View>

        {/* urgency line — the whole reason Saved isn't a dead wishlist */}
        <StatusBadge status={status} viewers={viewers} />
      </View>
    </Pressable>
  );
}

function StatusBadge({ status, viewers }: { status: SavedStatus; viewers?: number }) {
  if (status === 'viewing') {
    return (
      <View style={[styles.badge, styles.badgeAccent]}>
        <View style={styles.pulse} />
        <Text style={styles.badgeAccentText}>
          {STATUS_COPY.viewing}{viewers ? ` · ${viewers}` : ''}
        </Text>
      </View>
    );
  }
  if (status === 'sold') {
    return (
      <View style={[styles.badge, styles.badgeSold]}>
        <Text style={styles.badgeSoldText}>{STATUS_COPY.sold}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.badgeMuted]}>
      <Text style={styles.badgeMutedText}>{STATUS_COPY.available}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  emptyText: { ...type.body, color: color.paperDim, textAlign: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md,
  },
  eyebrow: { ...type.eyebrow, color: color.paperDim },
  hero: { ...type.hero, color: color.paper, marginTop: space.xs },
  countWrap: { alignItems: 'flex-end' },
  countNum: { ...type.price, fontSize: 22, lineHeight: 24, color: color.paper },
  countLabel: { ...type.eyebrow, color: color.paperDim, marginTop: 2 },

  row: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderWidth: border.hairline, borderColor: color.line,
  },
  rowPressed: { borderColor: color.lineStrong },
  thumbWell: { width: 104, aspectRatio: 0.82, backgroundColor: color.surfaceAlt, position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  thumbSold: { opacity: 0.45 },
  soldOverlay: { position: 'absolute', left: 0, right: 0, top: '50%', alignItems: 'center', transform: [{ translateY: -11 }] },
  soldStamp: {
    ...type.title, color: color.ink, backgroundColor: color.paper,
    paddingHorizontal: space.sm, paddingVertical: 2, letterSpacing: 1.5,
  },

  rowBody: { flex: 1, padding: space.md },
  brand: { ...type.eyebrow, color: color.paperDim },
  title: { ...type.title, color: color.paper, marginTop: space.xs },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, marginTop: space.sm },
  price: { ...type.price, color: color.paper },
  size: { ...type.price, fontSize: 12, color: color.paperDim },

  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md, paddingHorizontal: space.sm, paddingVertical: 4 },
  badgeAccent: { backgroundColor: color.hiVis },
  badgeAccentText: { ...type.eyebrow, color: color.onHiVis },
  pulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.onHiVis },
  badgeSold: { backgroundColor: color.paper },
  badgeSoldText: { ...type.eyebrow, color: color.ink },
  badgeMuted: { borderWidth: border.hairline, borderColor: color.lineStrong },
  badgeMutedText: { ...type.eyebrow, color: color.paperDim },
});
