import React from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { color, type, space, radius, border } from '../theme';

/**
 * Filter / toggle chip. Selected state borrows the one accent — so a screen
 * should only ever have ONE conceptual group of chips fighting for it.
 */
type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export default function Chip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipOn,
        pressed && !selected && styles.chipPressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: border.hairline,
    borderColor: color.line,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  chipPressed: { borderColor: color.lineStrong },
  chipOn: { backgroundColor: color.hiVis, borderColor: color.hiVis },
  label: { ...type.eyebrow, color: color.paperDim },
  labelOn: { color: color.onHiVis },
});
