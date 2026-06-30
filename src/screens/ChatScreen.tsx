import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { color, type, space, border } from '../theme';
import { getChatThread, sendChatMessage, type ChatMessage } from '../data/mockAccount';
import ScreenHeader from '../components/ScreenHeader';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    getChatThread().then(setMessages);
  }, []);

  const scrollToEnd = () => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setSending(true);
    const next = await sendChatMessage(text);
    setMessages(next);
    setSending(false);
    scrollToEnd();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="WE REPLY FAST"
        title="Support"
        dismissIcon="close"
        right={<View style={styles.onlineDot} />}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        {!messages ? (
          <View style={styles.center}>
            <ActivityIndicator color={color.hiVis} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: space.lg, gap: space.md }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}
          >
            <Text style={styles.dayMark}>TODAY</Text>
            {messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
            {sending && <Text style={styles.typing}>Agent is typing…</Text>}
          </ScrollView>
        )}

        {/* Composer */}
        <View style={[styles.composer, { paddingBottom: insets.bottom + space.sm }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message support…"
            placeholderTextColor={color.paperDim}
            style={styles.input}
            multiline
            onSubmitEditing={onSend}
          />
          <Pressable
            onPress={onSend}
            disabled={!draft.trim()}
            style={({ pressed }) => [styles.send, !draft.trim() && styles.sendOff, pressed && !!draft.trim() && { opacity: 0.85 }]}
          >
            <Ionicons name="arrow-up" size={20} color={draft.trim() ? color.onHiVis : color.paperDim} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.from === 'user';
  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowAgent]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleAgent]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  onlineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.hiVis },

  dayMark: { ...type.eyebrow, color: color.paperDim, alignSelf: 'center', marginBottom: space.sm },

  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowAgent: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 2 },
  bubbleAgent: { backgroundColor: color.surface, borderWidth: border.hairline, borderColor: color.line },
  bubbleMine: { backgroundColor: color.surfaceAlt, borderWidth: border.hairline, borderColor: color.lineStrong },
  bubbleText: { ...type.body, color: color.paper },
  bubbleTextMine: { color: color.paper },

  typing: { ...type.caption, color: color.paperDim, marginLeft: space.xs },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: space.sm,
    paddingHorizontal: space.lg, paddingTop: space.sm,
    borderTopWidth: border.hairline, borderTopColor: color.line, backgroundColor: color.ink,
  },
  input: {
    flex: 1, ...type.body, color: color.paper,
    backgroundColor: color.surfaceAlt, borderWidth: border.hairline, borderColor: color.line,
    paddingHorizontal: space.md, paddingVertical: space.sm, maxHeight: 120,
  },
  send: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: color.hiVis },
  sendOff: { backgroundColor: color.surfaceAlt, borderWidth: border.hairline, borderColor: color.line },
});
