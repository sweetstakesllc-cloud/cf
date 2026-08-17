import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, type, space, border } from '../theme';
import { links, trustpilot } from '../features';

/**
 * The utility bar, mirroring the one across the top of circularfash.com: what
 * is happening now on the left, why to trust us on the right.
 *
 * Both belong on Home rather than buried in Account. A live drop is the thing
 * an app is actually good at catching, and a first-time browser weighs up trust
 * while looking at the stock — not in a settings screen they may never open.
 *
 * It is one bar, not two strips, because vertical space above the grid is the
 * most expensive on the screen: everything pushed down is stock not seen.
 */

/** Trustpilot's own green, used only on their star, as their brand asks. */
const TRUSTPILOT_GREEN = '#00B67A';

export default function TopBar() {
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={() => Linking.openURL(links.tiktok)}
        style={({ pressed }) => [styles.side, pressed && styles.pressed]}
        accessibilityRole="link"
        accessibilityLabel="Live on TikTok, opens TikTok"
      >
        <View style={styles.dot} />
        <Text style={styles.label}>LIVE ON TIKTOK</Text>
      </Pressable>

      <Pressable
        onPress={() => Linking.openURL(links.trustpilot)}
        style={({ pressed }) => [styles.side, pressed && styles.pressed]}
        accessibilityRole="link"
        accessibilityLabel={`Rated ${trustpilot.score} out of 5 from ${trustpilot.reviews} reviews on Trustpilot, opens Trustpilot`}
      >
        <Ionicons name="star" size={11} color={TRUSTPILOT_GREEN} />
        <Text style={styles.label}>
          {trustpilot.score} TRUSTPILOT
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    height: 34,
    borderBottomWidth: border.hairline,
    borderBottomColor: color.line,
    backgroundColor: color.surface,
  },
  side: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.hiVis },
  label: { ...type.eyebrow, color: color.paperDim },
});
