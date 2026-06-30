import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { color, type, space, border } from '../theme';

/**
 * Header for stack screens pushed above the tabs (Rewards, Refer, Live, Chat).
 * Back chevron + mono eyebrow + display title, on the brand ink. Optional
 * right-side accessory.
 */
type Props = {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
  /** 'close' for modally-presented screens (Chat), 'back' otherwise. */
  dismissIcon?: 'back' | 'close';
};

export default function ScreenHeader({ eyebrow, title, right, dismissIcon = 'back' }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.row}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name={dismissIcon === 'close' ? 'close' : 'chevron-back'} size={22} color={color.paper} />
        </Pressable>
        <View style={styles.titles}>
          {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: color.ink,
    borderBottomWidth: border.hairline,
    borderBottomColor: color.line,
    paddingBottom: space.md,
    paddingHorizontal: space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  titles: { flex: 1 },
  eyebrow: { ...type.eyebrow, color: color.paperDim },
  title: { ...type.display, fontSize: 20, color: color.paper, marginTop: 2 },
  right: { minWidth: 32, alignItems: 'flex-end' },
});
