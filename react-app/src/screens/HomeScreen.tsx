import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { PostCard } from '../components/PostCard';
import { samplePosts } from '../components/samplePosts';
import { styles } from '../components/styles';

export function HomeScreen() {
  const [section, setSection] = useState<'discover' | 'following'>('discover');

  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <Text style={styles.logo}>博客小站</Text>
      <TextInput style={styles.searchInput} placeholder="搜索作品、作者、合集" placeholderTextColor="#9a8f8a" />

      <View style={styles.segmentedControl}>
        <Pressable
          style={[styles.segmentButton, section === 'discover' && styles.segmentButtonActive]}
          onPress={() => setSection('discover')}
        >
          <Text style={[styles.segmentText, section === 'discover' && styles.segmentTextActive]}>发现</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentButton, section === 'following' && styles.segmentButtonActive]}
          onPress={() => setSection('following')}
        >
          <Text style={[styles.segmentText, section === 'following' && styles.segmentTextActive]}>关注</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>{section === 'discover' ? '今日推荐' : '关注更新'}</Text>
      {samplePosts.map((post) => (
        <PostCard key={post.id} post={post} showAuthor showStats />
      ))}
    </ScrollView>
  );
}
