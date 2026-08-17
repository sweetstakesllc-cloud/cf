import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { color, type, space, border, formatMoney } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { getLiveShows, type LiveShow } from '../data/mockAccount';
import ScreenHeader from '../components/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function whenLabel(show: LiveShow): string {
  const d = new Date(show.startsAt);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (show.status === 'live') return `Live now · ${show.viewers} watching`;
  if (show.status === 'upcoming') return `${day} · ${time}`;
  return `Ended · ${day}`;
}

export default function LiveScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [shows, setShows] = useState<LiveShow[] | null>(null);

  useEffect(() => {
    getLiveShows().then(setShows);
  }, []);

  return (
    <View style={styles.screen}>
      <ScreenHeader eyebrow="REAL-TIME DROPS" title="Live Shopping" />
      {!shows ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.hiVis} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxxl, gap: space.xl }}
        >
          {shows.map((show) => (
            <ShowCard
              key={show.id}
              show={show}
              onOpenProduct={(id) => navigation.navigate('Product', { id })}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function ShowCard({ show, onOpenProduct }: { show: LiveShow; onOpenProduct: (id: string) => void }) {
  const live = show.status === 'live';
  const ended = show.status === 'ended';

  return (
    <View style={[styles.card, live && styles.cardLive]}>
      <View style={styles.coverWrap}>
        <Image source={{ uri: show.cover }} style={[styles.cover, ended && styles.coverEnded]} resizeMode="cover" />
        {/* status badge — live carries the one accent */}
        {live ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{ended ? 'REPLAY' : 'UPCOMING'}</Text>
          </View>
        )}
        {live && (
          <View style={styles.viewers}>
            <Ionicons name="eye" size={12} color={color.paper} />
            <Text style={styles.viewersText}>{show.viewers}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{show.title}</Text>
        <Text style={styles.meta}>{whenLabel(show)}</Text>
        <Text style={styles.host}>{show.host}</Text>

        {/* featured pieces */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={{ gap: space.sm }}>
          {show.featured.map((p) => (
            <Pressable key={p.id} onPress={() => onOpenProduct(p.id)} style={({ pressed }) => [styles.thumbWrap, pressed && { opacity: 0.85 }]}>
              <Image source={{ uri: p.images[0] }} style={styles.thumb} resizeMode="cover" />
              <Text style={styles.thumbPrice}>{formatMoney(p.price, p.currencyCode)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* CTA */}
        {live ? (
          <Pressable style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
            <Text style={styles.ctaText}>JOIN LIVE</Text>
          </Pressable>
        ) : ended ? (
          <Pressable style={({ pressed }) => [styles.ctaGhost, pressed && { opacity: 0.7 }]}>
            <Text style={styles.ctaGhostText}>WATCH REPLAY</Text>
          </Pressable>
        ) : (
          <Pressable style={({ pressed }) => [styles.ctaGhost, pressed && { opacity: 0.7 }]}>
            <Ionicons name="notifications-outline" size={15} color={color.paper} />
            <Text style={styles.ctaGhostText}>REMIND ME</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: { borderWidth: border.hairline, borderColor: color.line, backgroundColor: color.surface },
  cardLive: { borderColor: color.hiVis },

  coverWrap: { position: 'relative', backgroundColor: color.surfaceAlt },
  cover: { width: '100%', height: 200 },
  coverEnded: { opacity: 0.5 },

  liveBadge: {
    position: 'absolute', top: space.md, left: space.md,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: color.hiVis, paddingHorizontal: space.sm, paddingVertical: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.onHiVis },
  liveText: { ...type.eyebrow, color: color.onHiVis },
  statusBadge: {
    position: 'absolute', top: space.md, left: space.md,
    backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: border.hairline, borderColor: color.line,
    paddingHorizontal: space.sm, paddingVertical: 4,
  },
  statusText: { ...type.eyebrow, color: color.paper },
  viewers: {
    position: 'absolute', top: space.md, right: space.md,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.88)', paddingHorizontal: space.sm, paddingVertical: 4,
  },
  viewersText: { ...type.price, fontSize: 12, color: color.paper },

  body: { padding: space.lg },
  title: { ...type.title, fontSize: 16, color: color.paper },
  meta: { ...type.price, fontSize: 12, color: color.paperDim, marginTop: space.sm },
  host: { ...type.caption, color: color.paperDim, marginTop: 2 },

  strip: { marginTop: space.lg },
  thumbWrap: { width: 64 },
  thumb: { width: 64, height: 78, backgroundColor: color.surfaceAlt },
  thumbPrice: { ...type.price, fontSize: 10, color: color.paperDim, marginTop: 4 },

  cta: { backgroundColor: color.hiVis, alignItems: 'center', paddingVertical: space.md, marginTop: space.lg },
  ctaText: { ...type.title, fontSize: 14, color: color.onHiVis, letterSpacing: 1 },
  ctaGhost: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    borderWidth: border.heavy, borderColor: color.paper, paddingVertical: space.md, marginTop: space.lg,
  },
  ctaGhostText: { ...type.title, fontSize: 14, color: color.paper, letterSpacing: 1 },
});
