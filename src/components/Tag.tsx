import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { color, type, space, radius, border } from '../theme';

/**
 * A small spec-tag: hard-edged bordered label. Used for condition, size, SKU —
 * the technical, garment-ticket details. Variant 'accent' inverts onto hi-vis
 * for the rare moment a tag IS the one accent (e.g. freshest drop).
 */
type Props = {
  label: string;
  variant?: 'default' | 'accent' | 'inverted';
};

export default function Tag({ label, variant = 'default' }: Props) {
  return (
    <View style={[styles.tag, variant === 'accent' && styles.accent, variant === 'inverted' && styles.inverted]}>
      <Text style={[styles.text, variant === 'accent' && styles.textAccent, variant === 'inverted' && styles.textInverted]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    borderWidth: border.hairline,
    borderColor: color.lineStrong,
    borderRadius: radius.none,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    backgroundColor: 'transparent',
  },
  accent: { backgroundColor: color.hiVis, borderColor: color.hiVis },
  inverted: { backgroundColor: color.paper, borderColor: color.paper },
  text: { ...type.eyebrow, color: color.paperDim },
  textAccent: { color: color.onHiVis },
  textInverted: { color: color.ink },
});
