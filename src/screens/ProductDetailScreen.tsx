import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { color, type, space, border, formatSEK } from '../theme';
import type { Product } from '../types/product';
import type { RootStackParamList } from '../navigation/types';
import { getProduct } from '../data/mockProducts';
import { buyNow, CheckoutUnavailableError } from '../data/checkout';
import Tag from '../components/Tag';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Product'>;
type Rt = RouteProp<RootStackParamList, 'Product'>;

export default function ProductDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [saved, setSaved] = useState(false);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getProduct(params.id).then((p) => {
      if (!alive) return;
      setProduct(p);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [params.id]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={color.hiVis} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.screen, styles.center, { padding: space.xl }]}>
        <Text style={styles.missing}>This piece is no longer available.</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backInline}>
          <Text style={styles.backInlineText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const sold = !product.availableForSale;
  const onSale = !!product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPct = onSale
    ? Math.round((1 - product.price / (product.compareAtPrice as number)) * 100)
    : 0;

  const imageH = width * (1100 / 900); // mirrors the 900x1100 source ratio

  const onBuyNow = async () => {
    // Quantity-one items aren't reserved until checkout completes — two people
    // can race for one piece, so the "just sold" loss is a normal outcome here,
    // not an edge case. Mint a single-item cart and hand off to Shopify's
    // hosted checkout.
    if (buying) return;
    setBuying(true);
    try {
      await buyNow(product);
    } catch (err) {
      const msg =
        err instanceof CheckoutUnavailableError
          ? err.message
          : 'Something went wrong starting checkout. Please try again.';
      Alert.alert('Can’t check out', msg, [{ text: 'OK' }]);
    } finally {
      setBuying(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        {/* Image carousel */}
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPage(Math.round(e.nativeEvent.contentOffset.x / width))
            }
          >
            {product.images.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={[{ width, height: imageH }, sold && styles.imageSold]}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {/* condition tag over the photo */}
          {!!product.condition && (
            <View style={styles.conditionOverlay}>
              <Tag label={product.condition} />
            </View>
          )}

          {/* SOLD as a flex */}
          {sold && (
            <View style={styles.soldOverlay} pointerEvents="none">
              <Text style={styles.soldStamp}>SOLD</Text>
            </View>
          )}

          {/* page dots */}
          {product.images.length > 1 && (
            <View style={styles.dots}>
              {product.images.map((_, i) => (
                <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
              ))}
            </View>
          )}

          {/* top controls */}
          <View style={[styles.topBar, { top: insets.top + space.sm }]}>
            <RoundButton icon="chevron-back" onPress={() => navigation.goBack()} />
            <RoundButton
              icon={saved ? 'bookmark' : 'bookmark-outline'}
              onPress={() => setSaved((s) => !s)}
              tint={saved ? color.hiVis : color.paper}
            />
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <Text style={styles.brand}>{product.brand}</Text>
          <Text style={styles.title}>{product.title}</Text>

          {/* price row + discount call-out */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatSEK(product.price)}</Text>
            {onSale && (
              <>
                <Text style={styles.compareAt}>{formatSEK(product.compareAtPrice as number)}</Text>
                <View style={styles.discount}>
                  <Text style={styles.discountText}>-{discountPct}%</Text>
                </View>
              </>
            )}
          </View>

          {/* meta row: size + sku */}
          <View style={styles.metaRow}>
            {!!product.size && <Spec label="SIZE" value={product.size} />}
            {!!product.category && <Spec label="CATEGORY" value={product.category} />}
            {!!product.sku && <Spec label="SKU" value={product.sku} />}
          </View>

          {/* Authenticity panel — prominent by design (conversion + 5.2 compliance) */}
          {product.authenticity?.verified && (
            <View style={styles.authPanel}>
              <View style={styles.authHead}>
                <Ionicons name="shield-checkmark" size={18} color={color.hiVis} />
                <Text style={styles.authTitle}>AUTHENTICITY VERIFIED</Text>
              </View>
              {!!product.authenticity.verifiedBy && (
                <Text style={styles.authBy}>{product.authenticity.verifiedBy}</Text>
              )}
              {!!product.authenticity.note && (
                <Text style={styles.authNote}>{product.authenticity.note}</Text>
              )}
            </View>
          )}

          {/* Description */}
          {!!product.description && (
            <Section title="DETAILS">
              <Text style={styles.description}>{product.description}</Text>
            </Section>
          )}

          {/* Measurements spec list */}
          {!!product.measurements?.length && (
            <Section title="MEASUREMENTS">
              <View style={styles.specList}>
                {product.measurements.map((m) => (
                  <View key={m.label} style={styles.specRow}>
                    <Text style={styles.specLabel}>{m.label}</Text>
                    <View style={styles.specLeader} />
                    <Text style={styles.specValue}>{m.value}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.specHint}>
                Measured flat by hand. One-of-one — there is no other size.
              </Text>
            </Section>
          )}
        </View>
      </ScrollView>

      {/* Sticky Add to Bag */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + space.md }]}>
        {sold ? (
          <View style={[styles.addBtn, styles.addBtnSold]}>
            <Text style={styles.addBtnSoldText}>SOLD — GONE FOR GOOD</Text>
          </View>
        ) : (
          <Pressable
            onPress={onBuyNow}
            disabled={buying}
            style={({ pressed }) => [
              styles.addBtn,
              pressed && styles.addBtnPressed,
              buying && styles.addBtnBusy,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: buying, busy: buying }}
            accessibilityLabel={`Buy ${product.brand} ${product.title} now for ${formatSEK(product.price)}`}
          >
            {buying ? (
              <ActivityIndicator color={color.onHiVis} />
            ) : (
              <>
                <Text style={styles.addBtnText}>BUY NOW</Text>
                <Text style={styles.addBtnPrice}>{formatSEK(product.price)}</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function RoundButton({
  icon,
  onPress,
  tint = color.paper,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={20} color={tint} />
    </Pressable>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.spec}>
      <Text style={styles.specKey}>{label}</Text>
      <Text style={styles.specVal}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  missing: { ...type.body, color: color.paperDim, textAlign: 'center' },
  backInline: { marginTop: space.lg, borderWidth: border.hairline, borderColor: color.lineStrong, paddingHorizontal: space.lg, paddingVertical: space.sm },
  backInlineText: { ...type.eyebrow, color: color.paper },

  imageSold: { opacity: 0.5 },
  conditionOverlay: { position: 'absolute', left: space.lg, bottom: space.lg },
  soldOverlay: { position: 'absolute', left: 0, right: 0, top: '42%', alignItems: 'center' },
  soldStamp: {
    ...type.hero,
    color: color.ink,
    backgroundColor: color.paper,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    letterSpacing: 3,
  },

  dots: { position: 'absolute', bottom: space.lg, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, backgroundColor: color.paperMute, opacity: 0.6 },
  dotOn: { backgroundColor: color.paper, opacity: 1 },

  topBar: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: border.hairline, borderColor: color.line,
  },

  body: { padding: space.lg },
  brand: { ...type.eyebrow, color: color.paperDim },
  title: { ...type.display, color: color.paper, marginTop: space.sm },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, marginTop: space.lg },
  price: { ...type.price, fontSize: 22, lineHeight: 26, color: color.paper },
  compareAt: { ...type.price, fontSize: 14, color: color.paperMute, textDecorationLine: 'line-through' },
  discount: { backgroundColor: color.hiVis, paddingHorizontal: space.sm, paddingVertical: 2 },
  discountText: { ...type.eyebrow, color: color.onHiVis },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xl, marginTop: space.xl },
  spec: {},
  specKey: { ...type.eyebrow, color: color.paperDim },
  specVal: { ...type.price, color: color.paper, marginTop: space.xs },

  authPanel: {
    marginTop: space.xxl,
    borderWidth: border.hairline,
    borderColor: color.lineStrong,
    backgroundColor: color.surface,
    padding: space.lg,
  },
  authHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  authTitle: { ...type.eyebrow, color: color.paper, letterSpacing: 1.4 },
  authBy: { ...type.caption, color: color.paperDim, marginTop: space.sm },
  authNote: { ...type.caption, color: color.paperDim, marginTop: space.xs },

  section: { marginTop: space.xxl },
  sectionTitle: { ...type.eyebrow, color: color.paperDim, marginBottom: space.md },
  description: { ...type.body, color: color.paperDim },

  specList: { borderTopWidth: border.hairline, borderTopColor: color.line },
  specRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: border.hairline, borderBottomColor: color.line,
  },
  specLabel: { ...type.body, color: color.paperDim },
  specLeader: { flex: 1 },
  specValue: { ...type.price, color: color.paper },
  specHint: { ...type.caption, color: color.paperDim, marginTop: space.md },

  cta: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: space.lg, paddingTop: space.md,
    backgroundColor: color.ink, borderTopWidth: border.hairline, borderTopColor: color.line,
  },
  addBtn: {
    backgroundColor: color.hiVis,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingVertical: space.lg,
  },
  addBtnPressed: { opacity: 0.85 },
  addBtnBusy: { justifyContent: 'center', opacity: 0.9 },
  addBtnText: { ...type.title, color: color.onHiVis, letterSpacing: 1 },
  addBtnPrice: { ...type.price, color: color.onHiVis },
  addBtnSold: { backgroundColor: color.surfaceAlt, justifyContent: 'center', borderWidth: border.hairline, borderColor: color.line },
  addBtnSoldText: { ...type.title, color: color.paperDim, letterSpacing: 1 },
});
