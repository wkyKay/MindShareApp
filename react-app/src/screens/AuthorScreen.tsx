import { useEffect, useState } from 'react';
import { Pressable, Text, View, FlatList } from 'react-native';
import { CollectionCard } from '../components/CollectionCard';
import { PostCard } from '../components/PostCard';
import { styles } from '../components/styles';
import { getAuthorPosts, getAuthorCollections, getAuthorInfo, setAuthorFollowing } from '../services/authorApi';
import type { AuthorInfo, ProfilePost, ProfileCollection } from '../services/authorApi';
import type { AuthSession } from '../services/authSession';

type AuthorTab = 'posts' | 'collections';
const PAGE_SIZE = 20;

type AuthorProps = {
  author_id: number;
  onOpenPost: (postId: number) => void;
  onBack: () => void;
  onRequireAuth: () => void;
  onOpenTag: (tag: string) => void;
  session: AuthSession | null;
};
export function AuthorScreen({ author_id, onOpenPost, onBack, onRequireAuth, onOpenTag, session }: AuthorProps) {
    const [activeTab, setActiveTab] = useState<AuthorTab>('posts');
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [posts, setPosts] = useState<ProfilePost[]>([]);
    const [postPage, setPostPage] = useState(0);
    const [postTotal, setPostTotal] = useState(0);
    const [postHasMore, setPostHasMore] = useState(true);
    const [collections, setCollections] = useState<ProfileCollection[]>([]);
    const [author, setAuthor] = useState<AuthorInfo | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
       let isMounted = true;
        async function fetchAuthorData(){
             try{
                 setIsLoading(true);
                 setMessage('');
                 setPosts([]);
                 setPostPage(0);
                 setPostTotal(0);
                 setPostHasMore(true);
                 const [authorData, postsData, collectionsData] = await Promise.all([
                     getAuthorInfo(author_id, session?.accessToken),
                     getAuthorPosts(author_id, 1, PAGE_SIZE),
                     getAuthorCollections(author_id),
                 ]);
                 if (!isMounted) return;
                 setPosts(postsData.items);
                 setPostPage(1);
                 setPostTotal(postsData.total);
                 setPostHasMore(PAGE_SIZE < postsData.total);
                 setCollections(collectionsData);
                 setAuthor(authorData);
             }catch(error){
                 if (isMounted) {
                    setMessage(error instanceof Error ? error.message : '作者内容加载失败');
                 }
             }finally{
                 if (isMounted) setIsLoading(false);
             }
       }
       fetchAuthorData();
       return () => {
        isMounted = false;
       }
     }, [author_id, session?.accessToken]);

    async function loadMorePosts() {
        if (activeTab !== 'posts' || isLoading || isLoadingMore || !postHasMore) {
            return;
        }
        setIsLoadingMore(true);
        setMessage('');
        try {
            const nextPage = postPage + 1;
            const data = await getAuthorPosts(author_id, nextPage, PAGE_SIZE);
            setPosts((currentPosts) => appendUniquePosts(currentPosts, data.items));
            setPostPage(nextPage);
            setPostTotal(data.total);
            setPostHasMore(nextPage * PAGE_SIZE < data.total);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '更多帖子加载失败');
        } finally {
            setIsLoadingMore(false);
        }
    }

    async function toggleFollow() {
        if (!session) {
            onRequireAuth();
            return;
        }
        if (!author || author.id === session.user.id) {
            return;
        }
        setMessage('');
        try {
            const data = await setAuthorFollowing(author.id, session.accessToken, !author.is_following);
            setAuthor({ ...author, is_following: data.following });
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '关注操作失败');
        }
    }

    const avatarText = author?.display_name.slice(0, 1) || author?.username.slice(0, 1) || '我';
    const currentData: (ProfilePost | ProfileCollection)[] = activeTab === 'posts' ? posts : collections;

    const header = (
        <>
            <Pressable style={styles.backButton} onPress={onBack}>
                <Text style={styles.backButtonText}>返回</Text>
            </Pressable>
            <View style={styles.profileHeader}>
                <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarText}</Text>
                </View>
                <View>
                <Text style={styles.pageTitle}>{author?.display_name}</Text>
                {author?.bio ? <Text style={styles.profileBio}>{author.bio}</Text> : null}
                </View>
            </View>

            {author && author.id !== session?.user.id ? (
                <Pressable
                    style={[styles.primaryButton, author.is_following && styles.actionButtonActive]}
                    onPress={toggleFollow}
                >
                    <Text style={author.is_following ? styles.actionButtonText : styles.primaryButtonText}>
                        {author.is_following ? '已关注，点击取消' : '关注作者'}
                    </Text>
                </Pressable>
            ) : null}
            {message ? <Text style={styles.authApiHint}>{message}</Text> : null}

            <View style={styles.profileStats}>
            <Pressable style={styles.profileStatItem} onPress={() => setActiveTab('posts')}>
            <Text style={styles.profileStatNumber}>{postTotal}</Text>
            <Text style={[styles.profileStatLabel, activeTab === 'posts' && styles.segmentTextActive]}>发布</Text>
            </Pressable>
            <Pressable style={styles.profileStatItem} onPress={() => setActiveTab('collections')}>
            <Text style={styles.profileStatNumber}>{collections.length}</Text>
            <Text style={[styles.profileStatLabel, activeTab === 'collections' && styles.segmentTextActive]}>合集</Text>
            </Pressable>
        </View>
      </>
    )

    const footer = () => {
        if (isLoading || isLoadingMore) {
            return <Text style={[styles.profileBio, { padding: 16, textAlign: 'center' }]}>正在加载内容...</Text>;
        }
        if (message) {
            return <Text style={[styles.authApiHint, { color: '#a05d6f', padding: 16 }]}>{message}</Text>;
        }
        return null;
    };

    return(
        <FlatList
        contentContainerStyle={styles.pageContent}
        data={currentData}
        renderItem={({ item }) =>
          activeTab === 'posts' ? (
            <PostCard post={item as ProfilePost} showStats onPress={() => onOpenPost(item.id)} onOpenTag={onOpenTag} />
          ) : (
            <CollectionCard collection={item as ProfileCollection} onPress={() => {}} />
          )
        }
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={!isLoading && !message ? <Text style={[styles.profileBio, { textAlign: 'center', padding: 16 }]}>暂无内容</Text> : null}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}/>
    )

}

function appendUniquePosts(currentPosts: ProfilePost[], incomingPosts: ProfilePost[]) {
    const existingIds = new Set(currentPosts.map((post) => post.id));
    return [...currentPosts, ...incomingPosts.filter((post) => !existingIds.has(post.id))];
}
