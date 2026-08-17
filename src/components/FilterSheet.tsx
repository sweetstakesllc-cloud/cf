import React from 'react';
import { View, Text, Pressable, Modal, SectionList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { color, type, space, border } from '../theme';

/**
 * Categories and brands, behind one control.
 *
 * They used to sit on Home as two labelled chip rows. That cost 137px — a
 * quarter of the screen — before a single product, and a horizontal scroller is
 * the wrong shape for a list this long: reaching "Valentino" meant swiping past
 * fifteen brands with no way to see what was coming. The website's collection
 * pages solved it the same way, with one FILTER control.
 */

type Props = {
  visible: boolean;
  categories: string[];
  brands: string[];
  activeCategory: string | null;
  activeBrand: string | null;
  onPickCategory: (value: string | null) => void;
  onPickBrand: (value: string | null) => void;
  onClose: () => void;
};

export default function FilterSheet({
  visible,
  categories,
  brands,
  activeCategory,
  activeBrand,
  onPickCategory,
  onPickBrand,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const hasFilter = activeCategory !== null || activeBrand !== null;

  const sections = [
    { title: 'CATEGORY', data: categories, active: activeCategory, pick: onPickCategory },
    { title: 'BRAND', data: brands, active: activeBrand, pick: onPickBrand },
  ].filter((s) => s.data.length > 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Text style={styles.title}>Filter</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close filters">
            <Ionicons name="close" size={24} color={color.paper} />
          </Pressable>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item, i) => item + i}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHead}>{section.title}</Text>
          )}
          renderItem={({ item, section }) => {
            const on = section.active === item;
            return (
              <Pressable
                onPress={() => section.pick(on ? null : item)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={[styles.rowLabel, on && styles.rowLabelOn]}>{item}</Text>
                {on && <Ionicons name="checkmark" size={18} color={color.paper} />}
              </Pressable>
            );
          }}
        />

        <View style={[styles.foot, { paddingBottom: insets.bottom + space.md }]}>
          {hasFilter && (
            <Pressable
              onPress={() => {
                onPickCategory(null);
                onPickBrand(null);
              }}
              style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
            >
              <Text style={styles.clearText}>CLEAR ALL</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.apply, pressed && styles.pressed]}
          >
            <Text style={styles.applyText}>SHOW RESULTS</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: color.ink, paddingTop: space.lg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  title: { ...type.hero, fontSize: 22, color: color.paper },
  pressed: { opacity: 0.7 },

  sectionHead: {
    ...type.eyebrow,
    color: color.paperMute,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: border.hairline,
    borderBottomColor: color.line,
  },
  rowLabel: { ...type.body, color: color.paper },
  rowLabelOn: { ...type.title, fontSize: 14 },

  foot: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: border.hairline,
    borderTopColor: color.line,
    backgroundColor: color.ink,
  },
  clear: {
    paddingHorizontal: space.lg,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.hairline,
    borderColor: color.lineStrong,
  },
  clearText: { ...type.eyebrow, color: color.paper },
  apply: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.hiVis,
  },
  applyText: { ...type.eyebrow, color: color.onHiVis },
});
