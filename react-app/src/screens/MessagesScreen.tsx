import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { styles } from '../components/styles';
import { useAuthStore } from '../stores/authStore';
import { useMessageStore } from '../stores/messageStore';
import { createOrGetConversation, getFollowingUsers, listConversations, searchUsers, type ConversationItem, type SearchUserItem } from '../services/messagesApi';

type MessagesScreenProps = {
  onOpenAuth: () => void;
  onOpenChat: (conversationId: number, partnerId: number, partnerName: string) => void;
};

export function MessagesScreen({ onOpenAuth, onOpenChat }: MessagesScreenProps) {
  const session = useAuthStore((state) => state.session);
  const latestMessageByConversation = useMessageStore((state) => state.latestMessageByConversation);
  const unreadByConversation = useMessageStore((state) => state.unreadByConversation);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [following, setFollowing] = useState<SearchUserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserItem[]>([]);
  const [message, setMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      void loadData();
    }, [session])
  );

  useEffect(() => {
    let isMounted = true;
    const q = searchQuery.trim();
    if (!session) return;
    if (!q) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await searchUsers(session.accessToken, q);
        if (isMounted) setSearchResults(data);
      } catch {
        if (isMounted) setSearchResults([]);
      }
    }, 250);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, session]);

  async function loadData() {
    if (!session) return;
    try {
      const [conversationData, followingData] = await Promise.all([
        listConversations(session.accessToken),
        getFollowingUsers(session.accessToken),
      ]);
      setConversations(conversationData);
      setFollowing(followingData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '消息加载失败');
    }
  }

  async function startChat(partnerId: number, partnerName: string) {
    if (!session) {
      onOpenAuth();
      return;
    }
    const data = await createOrGetConversation(session.accessToken, partnerId);
    onOpenChat(data.id, partnerId, partnerName);
  }

  const empty = useMemo(() => conversations.length === 0, [conversations.length]);

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.pageContent}>
        <Text style={styles.pageTitle}>私信</Text>
        <Text style={styles.profileBio}>登录后可以查看会话并给关注的人发私信。</Text>
        <Pressable style={styles.primaryButton} onPress={onOpenAuth}>
          <Text style={styles.primaryButtonText}>去登录</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.pageContent}
      data={conversations}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <>
          <Text style={styles.pageTitle}>私信</Text>
          <View style={styles.messagePanel}>
            <Text style={styles.sectionTitle}>搜索用户</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="输入用户名或昵称"
              placeholderTextColor="#9a8f8a"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchResults.length > 0 ? searchResults.map((user) => (
              <Pressable key={`search-${user.id}`} style={styles.messageUserItem} onPress={() => void startChat(user.id, user.display_name)}>
                <Text style={styles.cardTitle}>{user.display_name}</Text>
                <Text style={styles.profileBio}>@{user.username}</Text>
              </Pressable>
            )) : null}
            <Text style={styles.sectionTitle}>关注的人</Text>
            {following.map((user) => (
              <Pressable key={`follow-${user.id}`} style={styles.messageUserItem} onPress={() => void startChat(user.id, user.display_name)}>
                <Text style={styles.cardTitle}>{user.display_name}</Text>
                <Text style={styles.profileBio}>@{user.username}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionTitle}>会话</Text>
        </>
      }
      ListEmptyComponent={!message && empty ? <Text style={styles.profileBio}>暂无会话，先从上方关注列表或搜索里发起私信。</Text> : null}
      renderItem={({ item }) => (
        <Pressable style={styles.messageConversationCard} onPress={() => onOpenChat(item.id, item.partner.id, item.partner.display_name)}>
          <Text style={styles.cardTitle}>{item.partner.display_name}</Text>
          <Text style={styles.profileBio}>{latestMessageByConversation[item.id]?.body || item.last_message?.body || '暂无消息'}</Text>
          <View style={styles.messageConversationMetaRow}>
            <Text style={styles.authApiHint}>{item.updated_at}</Text>
            {(unreadByConversation[item.id] || item.unread_count) > 0 ? <View style={styles.messageUnreadBadge}><Text style={styles.messageUnreadText}>{unreadByConversation[item.id] || item.unread_count}</Text></View> : null}
          </View>
        </Pressable>
      )}
      ListFooterComponent={message ? <Text style={[styles.authApiHint, { color: '#a05d6f', paddingTop: 12 }]}>{message}</Text> : null}
      showsVerticalScrollIndicator={false}
    />
  );
}
