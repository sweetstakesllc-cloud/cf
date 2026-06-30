import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { color, type, space, border } from '../theme';
import type { Condition } from '../types/product';
import { getFacets } from '../data/mockProducts';
import Chip from '../components/Chip';

const STEPS = [
  { n: '01', label: 'Snap it', detail: 'Photograph the piece — tag, label, any flaws.' },
  { n: '02', label: 'Tell us', detail: 'Brand, category and honest condition.' },
  { n: '03', label: 'We verify', detail: 'Our team authenticates and prices it.' },
  { n: '04', label: 'Get paid', detail: 'Approve the offer; we handle the rest.' },
];

const MAX_PHOTOS = 8;

export default function SellScreen() {
  const insets = useSafeAreaInsets();

  const [facets, setFacets] = useState<{ brands: string[]; categories: string[] } | null>(null);
  const [photos, setPhotos] = useState<number[]>([]); // stand-in for picked assets
  const [brand, setBrand] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    getFacets().then((f) => setFacets({ brands: f.brands, categories: f.categories }));
  }, []);

  const conditions: Condition[] = ['Excellent', 'Very Good', 'Good', 'Fair'];

  const addPhoto = () => {
    // Real build: expo-image-picker (camera + library), then upload privately to
    // the team — photos are NOT published to other shoppers, which keeps the UGC
    // surface light (still needs a content policy + report path, see PROJECT.md).
    if (photos.length >= MAX_PHOTOS) return;
    setPhotos((p) => [...p, p.length]);
  };

  const removePhoto = (idx: number) => setPhotos((p) => p.filter((_, i) => i !== idx));

  const ready = photos.length > 0 && !!brand && !!category && !!condition;

  const submit = () => {
    if (!ready) return;
    Alert.alert(
      'Submitted for review',
      `${brand} · ${category} · ${condition}\n${photos.length} photo${photos.length === 1 ? '' : 's'}\n\nOur team will verify and come back with an offer.`,
      [
        {
          text: 'Done',
          onPress: () => {
            setPhotos([]);
            setBrand(null);
            setCategory(null);
            setCondition(null);
            setNotes('');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TURN IT OVER</Text>
          <Text style={styles.hero}>Sell to Us</Text>
        </View>

        {/* 4-step explainer */}
        <View style={styles.steps}>
          {STEPS.map((s) => (
            <View key={s.n} style={styles.step}>
              <Text style={styles.stepNum}>{s.n}</Text>
              <View style={styles.stepBody}>
                <Text style={styles.stepLabel}>{s.label}</Text>
                <Text style={styles.stepDetail}>{s.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Photo dropzone */}
        <Field label="PHOTOS" hint={`${photos.length}/${MAX_PHOTOS}`}>
          <View style={styles.photoGrid}>
            {photos.map((id, idx) => (
              <View key={id} style={styles.photoTile}>
                <Ionicons name="image" size={22} color={color.paperMute} />
                <Pressable style={styles.photoRemove} hitSlop={8} onPress={() => removePhoto(idx)}>
                  <Ionicons name="close" size={14} color={color.ink} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <Pressable
                onPress={addPhoto}
                style={({ pressed }) => [styles.dropzone, pressed && styles.dropzonePressed]}
              >
                <Ionicons name="add" size={26} color={color.paperDim} />
                <Text style={styles.dropzoneText}>ADD</Text>
              </Pressable>
            )}
          </View>
        </Field>

        {/* Brand */}
        <Field label="BRAND">
          <View style={styles.chipWrap}>
            {facets?.brands.map((b) => (
              <Chip key={b} label={b} selected={brand === b} onPress={() => setBrand(brand === b ? null : b)} />
            ))}
          </View>
        </Field>

        {/* Category */}
        <Field label="CATEGORY">
          <View style={styles.chipWrap}>
            {facets?.categories.map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />
            ))}
          </View>
        </Field>

        {/* Condition */}
        <Field label="CONDITION">
          <View style={styles.chipWrap}>
            {conditions.map((c) => (
              <Chip key={c} label={c} selected={condition === c} onPress={() => setCondition(condition === c ? null : c)} />
            ))}
          </View>
        </Field>

        {/* Notes */}
        <Field label="NOTES (OPTIONAL)">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Flaws, proof of purchase, measurements…"
            placeholderTextColor={color.paperDim}
            multiline
            style={styles.input}
          />
        </Field>

        <Pressable
          onPress={submit}
          disabled={!ready}
          style={({ pressed }) => [
            styles.submit,
            !ready && styles.submitDisabled,
            pressed && ready && styles.submitPressed,
          ]}
        >
          <Text style={[styles.submitText, !ready && styles.submitTextDisabled]}>
            {ready ? 'SUBMIT FOR REVIEW' : 'ADD A PHOTO + DETAILS'}
          </Text>
        </Pressable>

        <Text style={styles.policy}>
          By submitting you confirm the item is authentic and yours to sell. Photos go
          privately to our team for verification.
        </Text>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  header: { paddingHorizontal: space.lg, paddingTop: space.md },
  eyebrow: { ...type.eyebrow, color: color.paperDim },
  hero: { ...type.hero, color: color.paper, marginTop: space.xs },

  steps: { paddingHorizontal: space.lg, marginTop: space.xl, gap: space.md },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  stepNum: { ...type.price, color: color.hiVis, width: 28 },
  stepBody: { flex: 1, borderBottomWidth: border.hairline, borderBottomColor: color.line, paddingBottom: space.md },
  stepLabel: { ...type.title, color: color.paper },
  stepDetail: { ...type.caption, color: color.paperDim, marginTop: 2 },

  field: { marginTop: space.xxl, paddingHorizontal: space.lg },
  fieldHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.md },
  fieldLabel: { ...type.eyebrow, color: color.paperDim },
  fieldHint: { ...type.price, fontSize: 12, color: color.paperDim },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  photoTile: {
    width: 76, height: 76, backgroundColor: color.surfaceAlt,
    borderWidth: border.hairline, borderColor: color.line,
    alignItems: 'center', justifyContent: 'center',
  },
  photoRemove: {
    position: 'absolute', top: -7, right: -7,
    width: 20, height: 20, borderRadius: 10, backgroundColor: color.paper,
    alignItems: 'center', justifyContent: 'center',
  },
  dropzone: {
    width: 76, height: 76,
    borderWidth: border.hairline, borderColor: color.lineStrong, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  dropzonePressed: { borderColor: color.paperDim },
  dropzoneText: { ...type.eyebrow, fontSize: 9, color: color.paperDim },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  input: {
    ...type.body,
    color: color.paper,
    backgroundColor: color.surfaceAlt,
    borderWidth: border.hairline, borderColor: color.line,
    padding: space.md, minHeight: 88, textAlignVertical: 'top',
  },

  submit: { marginHorizontal: space.lg, marginTop: space.xxxl, backgroundColor: color.hiVis, paddingVertical: space.lg, alignItems: 'center' },
  submitPressed: { opacity: 0.85 },
  submitDisabled: { backgroundColor: color.surfaceAlt, borderWidth: border.hairline, borderColor: color.line },
  submitText: { ...type.title, color: color.onHiVis, letterSpacing: 1 },
  submitTextDisabled: { color: color.paperMute },

  policy: { ...type.caption, color: color.paperDim, paddingHorizontal: space.lg, marginTop: space.lg },
});
