import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { color, type, space, border } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { getLoyalty, getLiveShows, type Loyalty } from '../data/mockAccount';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AccountScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [liveNow, setLiveNow] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getLoyalty().then((l) => alive && setLoyalty(l));
      getLiveShows().then((s) => alive && setLiveNow(s.some((x) => x.status === 'live')));
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

        {/* Member card → Rewards */}
        <Pressable
          onPress={() => navigation.navigate('Rewards')}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.cardName}>Amara L.</Text>
              <Text style={styles.cardTier}>{loyalty ? `${loyalty.tier} member` : '—'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={color.onHiVis} />
          </View>
          <View style={styles.cardBottom}>
            <Text style={styles.cardPoints}>{loyalty ? loyalty.points.toLocaleString('sv-SE') : '—'}</Text>
            <Text style={styles.cardPointsLabel}>POINTS</Text>
          </View>
        </Pressable>

        {/* Feature rows */}
        <View style={styles.group}>
          <Row
            icon="ribbon-outline"
            label="Rewards & Points"
            sub="Redeem points, track your tier"
            onPress={() => navigation.navigate('Rewards')}
          />
          <Row
            icon="gift-outline"
            label="Refer a Friend"
            sub="Give 150 kr, get 750 pts"
            onPress={() => navigation.navigate('Refer')}
          />
          <Row
            icon="videocam-outline"
            label="Live Shopping"
            sub="Shop drops in real time"
            badge={liveNow ? 'LIVE' : undefined}
            onPress={() => navigation.navigate('Live')}
          />
          <Row
            icon="chatbubble-ellipses-outline"
            label="Help & Support"
            sub="Chat with our team"
            onPress={() => navigation.navigate('Chat')}
            last
          />
        </View>

        <Text style={styles.note}>
          Orders, addresses and sign-in arrive with the accounts phase.
        </Text>
      </ScrollView>
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
  badge?: string;
  last?: boolean;
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
      <Ionicons name="chevron-forward" size={18} color={color.paperDim} />
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
  cardName: { ...type.title, fontSize: 17, color: color.onHiVis },
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

  note: { ...type.caption, color: color.paperDim, paddingHorizontal: space.lg, marginTop: space.xl },
});
