import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { color, type, space, border } from '../theme';

/**
 * The brands, set large, first thing on Home.
 *
 * For luxury resale the opening question is "what do you actually have" — the
 * answer is a list of houses, and a count against each proves depth. Behind a
 * filter icon that answer is invisible: you had to already suspect Moncler was
 * there to go looking for it.
 *
 * Ordered by stock rather than alphabet, so the rail opens on what the shop is
 * deepest in instead of whoever starts with A.
 */

type Props = {
  brands: string[];
  counts: Record<string, number>;
  total: number;
  active: string | null;
  onPick: (brand: string | null) => void;
};

export default function BrandRail({ brands, counts, total, active, onPick }: Props) {
  if (brands.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.rail}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Item label="ALL" count={total} on={active === null} onPress={() => onPick(null)} />
      {brands.map((b) => (
        <Item
          key={b}
          label={b}
          count={counts[b] ?? 0}
          on={active === b}
          onPress={() => onPick(active === b ? null : b)}
        />
      ))}
    </ScrollView>
  );
}

function Item({
  label,
  count,
  on,
  onPress,
}: {
  label: string;
  count: number;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, on && styles.itemOn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label}, ${count} pieces`}
    >
      <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.count, on && styles.countOn]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Fixed height and no shrink: a horizontal ScrollView cannot derive its height
  // from horizontally-scrolling content on react-native-web, and collapses to a
  // sliver without it.
  // Negative margin cancels the grid's side padding, since this renders inside
  // the list's content container: the rail has to reach both screen edges or it
  // reads as a boxed-in widget rather than a run of names continuing offscreen.
  rail: { flexGrow: 0, flexShrink: 0, height: 62, marginHorizontal: -space.lg },
  content: { paddingHorizontal: space.lg, gap: space.lg, alignItems: 'center' },

  item: { paddingVertical: space.xs, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  itemOn: { borderBottomColor: color.hiVis },
  pressed: { opacity: 0.55 },

  // Set at display scale. These are the names people came for; they should read
  // from across the room, not sit in a 12px chip.
  name: { ...type.display, fontSize: 19, lineHeight: 23, color: color.paperMute },
  nameOn: { color: color.paper },
  count: { ...type.eyebrow, fontSize: 9.5, color: color.paperMute, marginTop: 1 },
  countOn: { color: color.paperDim },
});
