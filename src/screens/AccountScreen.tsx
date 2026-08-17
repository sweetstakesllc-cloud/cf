import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { color, type, space, border } from '../theme';
import { features, links } from '../features';
import type { RootStackParamList } from '../navigation/types';
import { getLoyalty, getLiveShows, type Loyalty } from '../data/mockAccount';
import { fetchMarkets, getMarket, setMarket, type Market } from '../data/market';
import app from '../../app.json';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Any engagement feature on? Then the hub keeps its in-app group. */
const hasEngagement = features.rewards || features.refer || features.live || features.chat;

export default function AccountScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [liveNow, setLiveNow] = useState(false);

  const [market, setMarketState] = useState<Market>(getMarket());
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const openMarketPicker = useCallback(() => {
    setPickerOpen(true);
    // Loaded on demand, not at launch: most shoppers never open this, and the
    // list is one more request against the Storefront API.
    if (!markets) fetchMarkets().then(setMarkets);
  }, [markets]);

  const chooseMarket = useCallback((next: Market) => {
    setMarket(next);
    setMarketState(next);
    setPickerOpen(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasEngagement) return;
      let alive = true;
      if (features.rewards) getLoyalty().then((l) => alive && setLoyalty(l));
      if (features.live) {
        getLiveShows().then((s) => alive && setLiveNow(s.some((x) => x.status === 'live')));
      }
      return () => {
        alive = false;
      };
    }, [])
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CIRCULAR FASH</Text>
          <Text style={styles.hero}>Account</Text>
        </View>

        {/* Member card → Rewards. Only real once a loyalty vendor is wired. */}
        {features.rewards && (
          <Pressable
            onPress={() => navigation.navigate('Rewards')}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.cardTier}>{loyalty ? `${loyalty.tier} member` : '—'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={color.onHiVis} />
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.cardPoints}>
                {loyalty ? loyalty.points.toLocaleString('sv-SE') : '—'}
              </Text>
              <Text style={styles.cardPointsLabel}>POINTS</Text>
            </View>
          </Pressable>
        )}

        {hasEngagement && (
          <View style={styles.group}>
            {features.rewards && (
              <Row
                icon="ribbon-outline"
                label="Rewards & Points"
                sub="Redeem points, track your tier"
                onPress={() => navigation.navigate('Rewards')}
              />
            )}
            {features.refer && (
              <Row
                icon="gift-outline"
                label="Refer a Friend"
                sub="Give 150 kr, get 750 pts"
                onPress={() => navigation.navigate('Refer')}
              />
            )}
            {features.live && (
              <Row
                icon="videocam-outline"
                label="Live Shopping"
                sub="Shop drops in real time"
                badge={liveNow ? 'LIVE' : undefined}
                onPress={() => navigation.navigate('Live')}
              />
            )}
            {features.chat && (
              <Row
                icon="chatbubble-ellipses-outline"
                label="Help & Support"
                sub="Chat with our team"
                onPress={() => navigation.navigate('Chat')}
                last
              />
            )}
          </View>
        )}

        {/* Trustpilot moved to the Home top bar — trust is weighed while
            looking at the stock, not in a settings screen. */}

        {/* Market: prices come back from Shopify already converted. */}
        <View style={styles.group}>
          <Row
            icon="globe-outline"
            label="Country & currency"
            sub={`${market.name} · ${market.currency}`}
            onPress={openMarketPicker}
            last
          />
        </View>

        {/* Real destinations: the storefront handles orders, support and policy. */}
        <View style={styles.group}>
          <Row
            icon="storefront-outline"
            label="Shop on circularfash.com"
            sub="The full archive in your browser"
            onPress={() => Linking.openURL(links.shop)}
            external
          />
          <Row
            icon="help-circle-outline"
            label="FAQ"
            sub="Authenticity, shipping, returns, selling"
            onPress={() => Linking.openURL(links.faq)}
            external
          />
          <Row
            icon="search-outline"
            label="Sourcing Requests"
            sub="Ask us to find a specific piece"
            onPress={() => Linking.openURL(links.sourcing)}
            external
          />
          <Row
            icon="information-circle-outline"
            label="About Us"
            sub="How Circular Fash works"
            onPress={() => Linking.openURL(links.about)}
            external
          />
          <Row
            icon="chatbubble-ellipses-outline"
            label="Help & Contact"
            sub="Questions about an order or an item"
            onPress={() => Linking.openURL(links.contact)}
            external
          />
          <Row
            icon="cube-outline"
            label="Shipping"
            sub="Delivery times and rates"
            onPress={() => Linking.openURL(links.shipping)}
            external
          />
          <Row
            icon="return-down-back-outline"
            label="Returns"
            sub="How returns work on one-of-one pieces"
            onPress={() => Linking.openURL(links.returns)}
            external
            last
          />
        </View>

        <View style={styles.group}>
          <Row
            icon="lock-closed-outline"
            label="Privacy Policy"
            sub="How we handle your data"
            onPress={() => Linking.openURL(links.privacy)}
            external
          />
          <Row
            icon="document-text-outline"
            label="Terms of Service"
            sub="The rules of the marketplace"
            onPress={() => Linking.openURL(links.terms)}
            external
            last
          />
        </View>

        <Text style={styles.note}>
          Checkout is handled securely by Shopify — you'll enter delivery details there. Orders,
          addresses and sign-in arrive with the accounts phase.
        </Text>
        <Text style={styles.version}>VERSION {app.expo.version}</Text>
      </ScrollView>

      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Country & currency</Text>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={color.paper} />
            </Pressable>
          </View>
          <Text style={styles.sheetNote}>
            Prices are converted by Shopify and charged in the currency you pick.
          </Text>
          {markets === null ? (
            <ActivityIndicator style={{ marginTop: space.xl }} color={color.hiVis} />
          ) : (
            <FlatList
              data={markets}
              keyExtractor={(m) => m.country}
              contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
              renderItem={({ item }) => {
                const active = item.country === market.country;
                return (
                  <Pressable
                    onPress={() => chooseMarket(item)}
                    style={({ pressed }) => [styles.marketRow, pressed && styles.pressed]}
                  >
                    <Text style={[styles.marketName, active && styles.marketNameOn]}>
                      {item.name}
                    </Text>
                    <Text style={styles.marketCurrency}>{item.currency}</Text>
                    {active && <Ionicons name="checkmark" size={18} color={color.paper} />}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function Row({
  icon,
  label,
  sub,
  onPress,
  badge,
  last,
  external,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
  badge?: string;
  last?: boolean;
  /** Leaves the app — signalled with an outbound glyph instead of a chevron. */
  external?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={color.paper} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {!!badge && (
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{badge}</Text>
        </View>
      )}
      <Ionicons
        name={external ? 'open-outline' : 'chevron-forward'}
        size={external ? 16 : 18}
        color={color.paperDim}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  header: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg },
  eyebrow: { ...type.eyebrow, color: color.paperDim },
  hero: { ...type.hero, color: color.paper, marginTop: space.xs },
  pressed: { opacity: 0.85 },

  // Member card carries the screen's single accent (hi-vis surface).
  card: { marginHorizontal: space.lg, backgroundColor: color.hiVis, padding: space.lg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTier: { ...type.eyebrow, color: color.onHiVis, opacity: 0.7, marginTop: 4 },
  cardBottom: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.xl },
  cardPoints: { ...type.price, fontSize: 30, lineHeight: 34, color: color.onHiVis },
  cardPointsLabel: { ...type.eyebrow, color: color.onHiVis, opacity: 0.7 },

  group: {
    marginTop: space.xl,
    marginHorizontal: space.lg,
    borderWidth: border.hairline,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  rowDivider: { borderBottomWidth: border.hairline, borderBottomColor: color.line },
  rowText: { flex: 1 },
  rowLabel: { ...type.title, fontSize: 14, color: color.paper },
  rowSub: { ...type.caption, color: color.paperDim, marginTop: 2 },

  // The card is this screen's one hi-vis block; the live indicator stays subtle
  // — an outlined chip with a single hi-vis status dot.
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: border.hairline, borderColor: color.lineStrong, paddingHorizontal: space.sm, paddingVertical: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.hiVis },
  liveText: { ...type.eyebrow, color: color.paper },

  sheet: { flex: 1, backgroundColor: color.ink, paddingTop: space.lg },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  sheetTitle: { ...type.hero, fontSize: 22, color: color.paper },
  sheetNote: { ...type.caption, color: color.paperDim, paddingHorizontal: space.lg, marginTop: space.xs, marginBottom: space.md },
  marketRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingVertical: space.md, paddingHorizontal: space.lg,
    borderBottomWidth: border.hairline, borderBottomColor: color.line,
  },
  marketName: { ...type.body, color: color.paper, flex: 1 },
  marketNameOn: { ...type.title, fontSize: 14 },
  marketCurrency: { ...type.eyebrow, color: color.paperDim },

  note: { ...type.caption, color: color.paperDim, paddingHorizontal: space.lg, marginTop: space.xl },
  version: { ...type.eyebrow, color: color.paperMute, paddingHorizontal: space.lg, marginTop: space.md },
});
