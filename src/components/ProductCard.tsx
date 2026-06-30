import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { color, type, space, radius, border, formatSEK } from '../theme';
import type { Product } from '../types/product';

/**
 * The product card in the "street high-contrast" direction.
 * Consumes the normalized `Product` (uses images[0] as the hero).
 * Carries the two states that matter on a grid: NEW flash and the inverted
 * SOLD stamp. Do not soften either — see the design rules in PROJECT.md.
 */

type Props = {
  product: Product;
  onPress?: (product: Product) => void;
  /** When true, suppress the NEW flash (e.g. on the Alerts feed where the
   *  freshest item already wears the one accent). */
  hideNew?: boolean;
};

export default function ProductCard({ product, onPress, hideNew }: Props) {
  const sold = !product.availableForSale;
  const onSale = !!product.compareAtPrice && product.compareAtPrice > product.price;
  const hero = product.images[0];

  return (
    <Pressable
      onPress={() => onPress?.(product)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${product.brand} ${product.title}, ${formatSEK(product.price)}${sold ? ', sold out' : ''}`}
    >
      <View style={styles.imageWell}>
        <Image
          source={{ uri: hero }}
          style={[styles.image, sold && styles.imageSold]}
          resizeMode="cover"
        />

        {product.isNew && !sold && !hideNew && (
          <View style={styles.newFlash}>
            <Text style={styles.newText}>NEW</Text>
          </View>
        )}

        {sold && (
          <View style={styles.soldRow}>
            <Text style={styles.soldStamp}>SOLD</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.brand} numberOfLines={1}>{product.brand}</Text>
        <Text style={styles.title} numberOfLines={2}>{product.title}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatSEK(product.price)}</Text>
          {onSale && (
            <Text style={styles.compareAt}>{formatSEK(product.compareAtPrice!)}</Text>
          )}
        </View>

        {!!product.size && (
          <View style={styles.sizeTag}>
            <Text style={styles.sizeText}>{product.size}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderWidth: border.hairline,
    borderColor: color.line,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  cardPressed: { borderColor: color.lineStrong, opacity: 0.92 },

  imageWell: {
    backgroundColor: color.surfaceAlt,
    aspectRatio: 0.82,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imageSold: { opacity: 0.45 },

  newFlash: {
    position: 'absolute', top: space.sm, left: space.sm,
    backgroundColor: color.hiVis, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.xs,
  },
  newText: { ...type.eyebrow, color: color.onHiVis },

  // SOLD as a flex: hard inverted stamp, not a greyed-out apology.
  soldRow: { position: 'absolute', left: 0, right: 0, top: '50%', alignItems: 'center', transform: [{ translateY: -16 }] },
  soldStamp: {
    ...type.display,
    color: color.ink, backgroundColor: color.paper,
    paddingHorizontal: space.md, paddingVertical: space.xs, letterSpacing: 2,
  },

  body: { padding: space.md },
  brand: { ...type.eyebrow, color: color.paperDim },
  title: { ...type.title, color: color.paper, marginTop: space.xs },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm },
  price: { ...type.price, color: color.paper },
  compareAt: { ...type.price, fontSize: 12, color: color.paperMute, textDecorationLine: 'line-through' },

  sizeTag: {
    alignSelf: 'flex-start', marginTop: space.md,
    borderWidth: border.hairline, borderColor: color.lineStrong, borderRadius: radius.none,
    paddingHorizontal: space.sm, paddingVertical: 3,
  },
  sizeText: { ...type.price, fontSize: 12, color: color.paperDim },
});
