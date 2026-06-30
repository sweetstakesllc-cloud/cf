import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { color, type, space, border } from '../theme';
import { getLoyalty, type Loyalty, type Reward } from '../data/mockAccount';
import ScreenHeader from '../components/ScreenHeader';

export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Loyalty | null>(null);

  useEffect(() => {
    getLoyalty().then(setData);
  }, []);

  const progress =
    data && data.nextTier ? Math.min(1, data.points / data.nextTier.at) : 1;

  return (
    <View style={styles.screen}>
      <ScreenHeader eyebrow="MEMBERSHIP" title="Rewards" />
      {!data ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.hiVis} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxxl }}
        >
          {/* Points + tier progress — the one accent */}
          <View style={styles.balance}>
            <Text style={styles.balanceNum}>{data.points.toLocaleString('sv-SE')}</Text>
            <Text style={styles.balanceLabel}>POINTS · {data.tier.toUpperCase()}</Text>

            {data.nextTier && (
              <>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${progress * 100}%` }]} />
                </View>
                <Text style={styles.toNext}>
                  {(data.nextTier.at - data.points).toLocaleString('sv-SE')} pts to {data.nextTier.name}
                </Text>
              </>
            )}
          </View>

          {/* Earn */}
          <Text style={styles.sectionTitle}>WAYS TO EARN</Text>
          <View style={styles.panel}>
            {data.earn.map((e, i) => (
              <View key={e.label} style={[styles.earnRow, i < data.earn.length - 1 && styles.divider]}>
                <Text style={styles.earnLabel}>{e.label}</Text>
                <Text style={styles.earnPts}>{e.points}</Text>
              </View>
            ))}
          </View>

          {/* Redeem */}
          <Text style={styles.sectionTitle}>REDEEM</Text>
          <View style={{ gap: space.md }}>
            {data.rewards.map((r) => (
              <RewardCard key={r.id} reward={r} points={data.points} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function RewardCard({ reward, points }: { reward: Reward; points: number }) {
  const affordable = !reward.locked && points >= reward.cost;
  return (
    <View style={styles.reward}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rewardLabel}>{reward.label}</Text>
        <Text style={styles.rewardCost}>{reward.cost.toLocaleString('sv-SE')} pts</Text>
      </View>
      {reward.locked ? (
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={13} color={color.paperDim} />
          <Text style={styles.lockText}>LOCKED</Text>
        </View>
      ) : (
        <Pressable
          disabled={!affordable}
          style={({ pressed }) => [
            styles.redeemBtn,
            !affordable && styles.redeemBtnOff,
            pressed && affordable && { opacity: 0.85 },
          ]}
        >
          <Text style={[styles.redeemText, !affordable && styles.redeemTextOff]}>
            {affordable ? 'REDEEM' : 'NOT YET'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  balance: { alignItems: 'center', paddingVertical: space.xl },
  balanceNum: { ...type.price, fontSize: 48, lineHeight: 52, color: color.hiVis },
  balanceLabel: { ...type.eyebrow, color: color.paperDim, marginTop: space.xs },
  track: { width: '100%', height: 6, backgroundColor: color.surfaceAlt, marginTop: space.xl },
  fill: { height: 6, backgroundColor: color.hiVis },
  toNext: { ...type.caption, color: color.paperDim, marginTop: space.sm },

  sectionTitle: { ...type.eyebrow, color: color.paperDim, marginTop: space.xxl, marginBottom: space.md },
  panel: { borderWidth: border.hairline, borderColor: color.line, backgroundColor: color.surface },
  earnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.lg },
  divider: { borderBottomWidth: border.hairline, borderBottomColor: color.line },
  earnLabel: { ...type.body, color: color.paper },
  earnPts: { ...type.price, fontSize: 13, color: color.paper },

  reward: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    borderWidth: border.hairline, borderColor: color.line, backgroundColor: color.surface,
    padding: space.lg,
  },
  rewardLabel: { ...type.title, fontSize: 14, color: color.paper },
  rewardCost: { ...type.price, fontSize: 12, color: color.paperDim, marginTop: 4 },
  // Outlined, not filled: the points balance + progress bar are this screen's
  // single hi-vis accent, so the redeem CTAs stay mono.
  redeemBtn: { borderWidth: border.heavy, borderColor: color.paper, paddingHorizontal: space.md, paddingVertical: space.sm },
  redeemBtnOff: { borderWidth: border.hairline, borderColor: color.line, paddingHorizontal: space.md, paddingVertical: space.sm },
  redeemText: { ...type.eyebrow, color: color.paper },
  redeemTextOff: { color: color.paperDim },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lockText: { ...type.eyebrow, color: color.paperDim },
});
