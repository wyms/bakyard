import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/ui/Avatar';
import type { SessionChatMessage } from '@/lib/types/database';

interface ChatProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface ChatMessageWithProfile extends SessionChatMessage {
  profile?: ChatProfile;
}

interface ChatThreadProps {
  sessionId: string;
  currentUserId: string;
}

export default function ChatThread({
  sessionId,
  currentUserId,
}: ChatThreadProps) {
  const [messages, setMessages] = useState<ChatMessageWithProfile[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const profileCache = useRef<Map<string, ChatProfile>>(new Map());

  // Fetch initial messages
  useEffect(() => {
    let cancelled = false;

    async function fetchMessages() {
      setLoading(true);
      const { data, error } = await supabase
        .from('session_chat_messages')
        .select('*, profile:profiles (id, full_name, avatar_url)')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (!error && data) {
        const typed = data as unknown as ChatMessageWithProfile[];
        // Cache profiles
        typed.forEach((msg) => {
          if (msg.profile) {
            profileCache.current.set(msg.user_id, msg.profile);
          }
        });
        setMessages(typed);
      }
      setLoading(false);
    }

    fetchMessages();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Subscribe to realtime messages
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload: { new: SessionChatMessage }) => {
          const newMsg = payload.new as ChatMessageWithProfile;

          // Try to get profile from cache or fetch it
          let profile = profileCache.current.get(newMsg.user_id);
          if (!profile) {
            const { data } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', newMsg.user_id)
              .single();
            if (data) {
              profile = data as ChatProfile;
              profileCache.current.set(newMsg.user_id, profile);
            }
          }
          newMsg.profile = profile;

          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setInput('');

    const { error } = await supabase.from('session_chat_messages').insert({
      session_id: sessionId,
      user_id: currentUserId,
      message: trimmed,
    });

    if (error) {
      // Restore input on failure
      setInput(trimmed);
    }
    setSending(false);
  }, [input, sending, sessionId, currentUserId]);

  function formatTimestamp(isoDate: string): string {
    return format(parseISO(isoDate), 'h:mm a');
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <ActivityIndicator size="small" color="#3F6F6A" />
        <Text className="text-xs text-charcoal/40 mt-2">Loading chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={120}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-2"
        contentContainerClassName="py-2"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View className="items-center py-8">
            <Ionicons name="chatbubbles-outline" size={32} color="#CCCCCC" />
            <Text className="text-sm text-charcoal/40 mt-2">
              No messages yet. Start the conversation!
            </Text>
          </View>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.user_id === currentUserId;
            const name = msg.profile?.full_name ?? 'Player';
            const avatarUri = msg.profile?.avatar_url ?? null;

            return (
              <View
                key={msg.id}
                className={`flex-row mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}
              >
                {!isOwn && (
                  <View className="mr-2 mt-0.5">
                    <Avatar uri={avatarUri} name={name} size="sm" />
                  </View>
                )}
                <View
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                    isOwn
                      ? 'bg-primary rounded-br-sm'
                      : 'bg-gray-100 rounded-bl-sm'
                  }`}
                >
                  {!isOwn && (
                    <Text className="text-[10px] font-semibold text-charcoal/60 mb-0.5">
                      {name.split(' ')[0]}
                    </Text>
                  )}
                  <Text
                    className={`text-sm ${
                      isOwn ? 'text-white' : 'text-charcoal'
                    }`}
                  >
                    {msg.message}
                  </Text>
                  <Text
                    className={`text-[10px] mt-1 ${
                      isOwn ? 'text-white/60 text-right' : 'text-charcoal/40'
                    }`}
                  >
                    {formatTimestamp(msg.created_at)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Input area */}
      <View className="flex-row items-end px-2 py-2 border-t border-stroke bg-surface">
        <TextInput
          className="flex-1 bg-gray-50 rounded-2xl px-4 py-2.5 text-sm text-charcoal mr-2 max-h-24"
          placeholder="Type a message..."
          placeholderTextColor="#9CA3AF"
          value={input}
          onChangeText={setInput}
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full bg-primary items-center justify-center"
          style={{ opacity: !input.trim() || sending ? 0.5 : 1 }}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
