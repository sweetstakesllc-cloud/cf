import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { color, type, space, border } from '../theme';
import { getReferral, type Referral } from '../data/mockAccount';
import ScreenHeader from '../components/ScreenHeader';

export default function ReferScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Referral | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getReferral().then(setData);
  }, []);

  const onShare = async () => {
    if (!data) return;
    try {
      await Share.share({
        message: `Get ${data.friendReward} at Circular Fash — pre-owned authentic luxury. Use my code ${data.code}.`,
      });
    } catch {
      // user dismissed — no-op
    }
  };

  const onCopy = () => {
    // Clipboard wiring (expo-clipboard) comes with the real build; reflect the
    // tap so the interaction reads correctly in the stub.
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader eyebrow="GIVE & GET" title="Refer a Friend" />
      {!data ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.hiVis} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxxl }}
        >
          <Text style={styles.lede}>
            Send a friend {data.friendReward}. When they make their first order, you
            get {data.youReward}.
          </Text>

          {/* The shareable code — one accent */}
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>YOUR CODE</Text>
            <Text style={styles.code}>{data.code}</Text>
            <Pressable onPress={onCopy} style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={color.onHiVis} />
              <Text style={styles.copyText}>{copied ? 'COPIED' : 'COPY'}</Text>
            </Pressable>
          </View>

          <Pressable onPress={onShare} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}>
            <Ionicons name="share-social-outline" size={18} color={color.paper} />
            <Text style={styles.shareText}>SHARE INVITE</Text>
          </Pressable>

          {/* Stats */}
          <View style={styles.stats}>
            <Stat n={data.invited} label="INVITED" />
            <View style={styles.statDivider} />
            <Stat n={data.joined} label="JOINED" />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lede: { ...type.body, color: color.paperDim, marginBottom: space.xl },

  codeBox: { backgroundColor: color.hiVis, padding: space.xl, alignItems: 'center' },
  codeLabel: { ...type.eyebrow, color: color.onHiVis, opacity: 0.7 },
  code: { ...type.price, fontSize: 24, lineHeight: 28, color: color.onHiVis, marginTop: space.sm, letterSpacing: 1 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.lg,
    borderWidth: border.heavy, borderColor: color.onHiVis, paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  copyText: { ...type.eyebrow, color: color.onHiVis },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    borderWidth: border.heavy, borderColor: color.paper, paddingVertical: space.lg, marginTop: space.lg,
  },
  shareText: { ...type.title, fontSize: 14, color: color.paper, letterSpacing: 1 },

  stats: { flexDirection: 'row', marginTop: space.xxl, borderWidth: border.hairline, borderColor: color.line, backgroundColor: color.surface },
  stat: { flex: 1, alignItems: 'center', paddingVertical: space.xl },
  statDivider: { width: border.hairline, backgroundColor: color.line },
  statNum: { ...type.price, fontSize: 26, lineHeight: 30, color: color.paper },
  statLabel: { ...type.eyebrow, color: color.paperDim, marginTop: space.xs },
});
