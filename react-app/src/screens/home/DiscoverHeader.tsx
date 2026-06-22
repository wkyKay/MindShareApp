import { Pressable, Text, TextInput, View } from "react-native";

import type { AppStyles } from "../../components/styles";
import { useDelayedLoading } from "../../hooks/useDelayedLoading";
import type { Post, UserSearchResult } from "../../services/homeApi";
import type { HomeSearchStatus } from "./hooks/useHomeSearch";

type DiscoverHeaderProps = {
  selectedTag: string | null;
  searchError: string;
  searchStatus: HomeSearchStatus;
  tagQuery: string;
  tagSuggestions: string[];
  userSuggestions: UserSearchResult[];
  titleMatches: Post[];
  onChangeQuery: (query: string) => void;
  onClearTag: () => void;
  onOpenPost: (postId: number) => void;
  onOpenAuthor: (authorId: number) => void;
  onSelectTag: (tag: string) => void;
  onSearchFocusChange: (isFocused: boolean) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function DiscoverHeader({
  selectedTag,
  searchError,
  searchStatus,
  tagQuery,
  tagSuggestions,
  userSuggestions,
  titleMatches,
  onChangeQuery,
  onClearTag,
  onOpenPost,
  onOpenAuthor,
  onSelectTag,
  onSearchFocusChange,
  styles,
  t,
}: DiscoverHeaderProps) {
  const showSearchLoading = useDelayedLoading(searchStatus === "loading", 250);
  const hasQuery = tagQuery.trim().length > 0;
  const hasResults =
    userSuggestions.length > 0 ||
    titleMatches.length > 0 ||
    tagSuggestions.length > 0;
  const showEmpty = hasQuery && searchStatus === "empty" && !hasResults;
  const showError = hasQuery && searchStatus === "error";

  return (
    <>
      {selectedTag ? (
        <View style={styles.selectedTagRow}>
          <Text style={styles.selectedTagText}>#{selectedTag}</Text>
          <Pressable onPress={onClearTag}>
            <Text style={styles.backButtonText}>{t("清除")}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.searchInput}
            placeholder={t("搜索用户、标题或 tag")}
            placeholderTextColor="#9a8f8a"
            value={tagQuery}
            onChangeText={onChangeQuery}
            onFocus={() => onSearchFocusChange(true)}
            onBlur={() => onSearchFocusChange(false)}
          />

          {showSearchLoading ? (
            <View style={styles.suggestionPanel}>
              <Text style={styles.suggestionEmptyText}>{t("正在搜索...")}</Text>
            </View>
          ) : null}

          {!showSearchLoading && hasResults && (
            <View style={styles.suggestionPanel}>
              {userSuggestions.length > 0 ? (
                <Text style={styles.suggestionSectionTitle}>{t("用户")}</Text>
              ) : null}
              {userSuggestions.map((user) => (
                <Pressable
                  key={`user-${user.id}`}
                  style={styles.suggestionItem}
                  onPress={() => onOpenAuthor(user.id)}
                >
                  <Text style={styles.suggestionText}>{user.display_name}</Text>
                  <Text style={styles.suggestionMeta}>
                    @{user.username}
                    {user.bio ? ` · ${user.bio}` : ""}
                  </Text>
                </Pressable>
              ))}

              {titleMatches.length > 0 ? (
                <Text style={styles.suggestionSectionTitle}>
                  {t("标题匹配")}
                </Text>
              ) : null}
              {titleMatches.map((post) => (
                <Pressable
                  key={`post-${post.id}`}
                  style={styles.suggestionItem}
                  onPress={() => onOpenPost(post.id)}
                >
                  <Text style={styles.suggestionText}>{post.title}</Text>
                  <Text style={styles.suggestionMeta}>
                    {post.author.display_name}
                    {post.tags.length > 0
                      ? ` · #${post.tags.slice(0, 2).join(" #")}`
                      : ""}
                  </Text>
                </Pressable>
              ))}

              {tagSuggestions.length > 0 ? (
                <Text style={styles.suggestionSectionTitle}>{t("标签")}</Text>
              ) : null}
              {tagSuggestions.map((tag) => (
                <Pressable
                  key={`tag-${tag}`}
                  style={styles.suggestionItem}
                  onPress={() => onSelectTag(tag)}
                >
                  <Text style={styles.suggestionText}>#{tag}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {!showSearchLoading && showError ? (
            <View style={styles.suggestionPanel}>
              <Text style={styles.suggestionEmptyText}>
                {searchError || t("搜索失败，请稍后重试")}
              </Text>
            </View>
          ) : null}

          {!showSearchLoading && showEmpty ? (
            <View style={styles.suggestionPanel}>
              <Text style={styles.suggestionEmptyText}>
                {t("没有找到相关用户、标题或标签")}
              </Text>
            </View>
          ) : null}
        </>
      )}
      <Text style={styles.sectionTitle}>
        {selectedTag ? t("标签博客") : t("今日推荐")}
      </Text>
    </>
  );
}
