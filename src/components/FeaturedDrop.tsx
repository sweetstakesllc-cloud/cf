import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { color, type, space, border, formatMoney } from '../theme';
import type { Product } from '../types/product';

/**
 * The top of Home: what the shop is, then the newest thing in it, large.
 *
 * Deliberately NOT a marketing hero. A stock photo above the stock is a toll
 * paid on every launch by someone who already chose us. This is a real piece —
 * the freshest one — so the space earns itself: it gives the app a face and it
 * is still something to buy.
 *
 * It lives in the FlatList header, so it scrolls away and costs nothing
 * permanent, and it is hidden while a filter is on: someone narrowing to
 * "Jackets under 2000" is hunting, not being introduced.
 */

type Props = {
  product: Product;
  onPress: (product: Product) => void;
};

export default function FeaturedDrop({ product, onPress }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onPress(product)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Just landed: ${product.brand} ${product.title}, ${formatMoney(
          product.price,
          product.currencyCode
        )}`}
      >
        <View style={styles.frame}>
          <Image source={{ uri: product.images[0] }} style={styles.image} resizeMode="contain" />
          <View style={styles.flash}>
            <Text style={styles.flashText}>JUST LANDED</Text>
          </View>
        </View>

        <View style={styles.meta}>
          <Text style={styles.brand}>{product.brand}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {product.title}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatMoney(product.price, product.currencyCode)}</Text>
            {!!product.size && <Text style={styles.size}>SIZE {product.size}</Text>}
          </View>
        </View>
      </Pressable>

      <Text style={styles.sectionHead}>ALSO LANDED</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  pressed: { opacity: 0.92 },

  card: {
    borderWidth: border.hairline,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  // Taller than the grid cards (4:5 rather than 3:4) so the featured piece reads
  // as an event, not just a bigger tile.
  frame: { aspectRatio: 4 / 5, backgroundColor: color.surface, position: 'relative' },
  image: { width: '100%', height: '100%' },

  flash: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    backgroundColor: color.hiVis,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  flashText: { ...type.eyebrow, color: color.onHiVis },

  meta: { padding: space.lg, borderTopWidth: border.hairline, borderTopColor: color.line },
  brand: { ...type.eyebrow, color: color.paperDim },
  title: { ...type.title, fontSize: 17, color: color.paper, marginTop: space.xs },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  price: { ...type.price, fontSize: 18, color: color.paper },
  size: { ...type.eyebrow, color: color.paperDim },

  sectionHead: {
    ...type.eyebrow,
    color: color.paperMute,
    marginTop: space.xl,
    marginBottom: space.xs,
  },
});
