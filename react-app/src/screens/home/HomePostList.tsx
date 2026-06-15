import type { ReactElement } from "react";
import { FlatList, View } from "react-native";

import type { AppStyles } from "../../components/styles";
import type { Post } from "../../services/homeApi";
import type { HomeSection } from "./hooks/useHomeTabs";

type HomePostListProps = {
  footer: (() => ReactElement | null) | null;
  header: ReactElement | null;
  isRefreshing: boolean;
  onEndReached: () => void;
  onRefresh: () => void;
  posts: Post[];
  renderPostItem: ({ item }: { item: Post }) => ReactElement;
  section: HomeSection;
  styles: AppStyles;
  target: HomeSection;
};

export function HomePostList({
  footer,
  header,
  isRefreshing,
  onEndReached,
  onRefresh,
  posts,
  renderPostItem,
  section,
  styles,
  target,
}: HomePostListProps) {
  const isActive = target === section;

  return (
    <View style={styles.homeScreen}>
      <FlatList
        style={styles.homeScreen}
        contentContainerStyle={styles.pageContent}
        data={posts}
        renderItem={renderPostItem}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        ListFooterComponent={isActive ? footer : null}
        onEndReached={() => {
          if (isActive) onEndReached();
        }}
        onEndReachedThreshold={0.35}
        refreshing={isActive && isRefreshing}
        onRefresh={() => {
          if (isActive) onRefresh();
        }}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
