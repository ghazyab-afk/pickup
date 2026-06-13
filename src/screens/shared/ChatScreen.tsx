import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../context/LanguageContext';

// ── Types ──────────────────────────────────────────────────────────────
interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
}

// ── Mock data ──────────────────────────────────────────────────────────
const MOCK_PEER = {
  name: 'Khalid Al Balushi',
  role: 'Driver',
  phone: '+96898765432',
  avatar: '🚛',
  status: 'online',
};

const INITIAL_MESSAGES: Message[] = [
  { id: '1', text: 'Hello! I am on my way to your pickup location.', sender: 'other', time: '10:32' },
  { id: '2', text: 'Great, I am ready! I will be waiting outside.', sender: 'me', time: '10:33' },
  { id: '3', text: 'I can see your building, arriving in 2 minutes.', sender: 'other', time: '10:35' },
  { id: '4', text: 'Perfect, see you soon! 👋', sender: 'me', time: '10:35' },
];

// ── Message Bubble ─────────────────────────────────────────────────────
function MessageBubble({ msg, isRTL }: { msg: Message; isRTL: boolean }) {
  const isMe = msg.sender === 'me';
  // In RTL, "me" messages are on the left; in LTR, on the right
  const alignRight = isRTL ? !isMe : isMe;

  return (
    <View
      className={`mb-3 max-w-[78%] ${alignRight ? 'self-end items-end' : 'self-start items-start'}`}
    >
      <View
        className={`rounded-2xl px-4 py-3 shadow-sm ${
          isMe
            ? 'bg-blue-600 rounded-br-sm'
            : 'bg-white border border-slate-100 rounded-bl-sm'
        }`}
      >
        <Text
          className={`text-base md:text-lg font-medium leading-relaxed ${
            isMe ? 'text-white' : 'text-slate-800'
          }`}
        >
          {msg.text}
        </Text>
      </View>
      <Text className="text-xs text-slate-400 font-medium mt-1 mx-1">{msg.time}</Text>
    </View>
  );
}

// ── Main Component ─────────────────────────────────────────────────────
export default function ChatScreen({ navigation }: any) {
  const { t, locale } = useTranslation();
  const isRTL = locale.startsWith('ar');

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ── Send message ────────────────────────────────────────────────────
  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setMessages((prev) => [...prev, { id: Date.now().toString(), text, sender: 'me', time }]);
    setInput('');

    // Simulate reply after 1.5s
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), text: t('chat.auto_reply'), sender: 'other', time },
      ]);
    }, 1500);
  };

  // ── Emergency call ──────────────────────────────────────────────────
  const handleCall = () => {
    Alert.alert(
      t('chat.call_title'),
      `${t('chat.call_confirm')} ${MOCK_PEER.name}?`,
      [
        { text: t('common.close'), style: 'cancel' },
        { text: t('chat.call_action'), onPress: () => Linking.openURL(`tel:${MOCK_PEER.phone}`) },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50"
      keyboardVerticalOffset={90}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View className="bg-white border-b border-slate-100 px-4 md:px-20 lg:px-48 py-3 md:py-4 flex-row items-center shadow-sm">
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          className="w-10 h-10 rounded-full items-center justify-center me-3"
        >
          <Ionicons
            name={isRTL ? 'chevron-forward' : 'chevron-back'}
            size={24}
            color="#1e293b"
          />
        </TouchableOpacity>

        {/* Avatar */}
        <View className="w-11 h-11 md:w-13 md:h-13 rounded-full bg-blue-100 items-center justify-center me-3">
          <Text className="text-2xl">{MOCK_PEER.avatar}</Text>
        </View>

        {/* Name + status */}
        <View className="flex-1">
          <Text className="text-base md:text-lg font-bold text-slate-800">{MOCK_PEER.name}</Text>
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-green-500 me-1" />
            <Text className="text-xs md:text-sm text-green-600 font-semibold">
              {t('chat.online')}
            </Text>
          </View>
        </View>

        {/* Call button */}
        <TouchableOpacity
          onPress={handleCall}
          className="w-11 h-11 md:w-13 md:h-13 rounded-full bg-green-500 items-center justify-center shadow-sm"
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* ── Messages area ───────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
        // Responsive horizontal padding
        style={{ paddingHorizontal: 0 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="md:px-20 lg:px-48">
          {/* Date divider */}
          <View className="items-center mb-4">
            <View className="bg-slate-200 rounded-full px-4 py-1">
              <Text className="text-xs text-slate-500 font-semibold">{t('chat.today')}</Text>
            </View>
          </View>

          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} isRTL={isRTL} />
          ))}
        </View>
      </ScrollView>

      {/* ── Input bar ───────────────────────────────────────────────── */}
      <View className="bg-white border-t border-slate-100 px-4 md:px-20 lg:px-48 py-3 md:py-4">
        <View className="flex-row items-end bg-slate-100 rounded-2xl px-3 py-2">
          <TextInput
            className="flex-1 text-base md:text-lg text-slate-800 font-medium max-h-28 py-2 px-2"
            placeholder={t('chat.input_placeholder')}
            placeholderTextColor="#94a3b8"
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="default"
            textAlign={isRTL ? 'right' : 'left'}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim()}
            className={`w-11 h-11 rounded-xl items-center justify-center ms-2 ${
              input.trim() ? 'bg-blue-600' : 'bg-slate-300'
            }`}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isRTL ? 'send' : 'send'}
              size={18}
              color="white"
              style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
