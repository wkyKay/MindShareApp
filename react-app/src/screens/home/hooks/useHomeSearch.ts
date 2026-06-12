import { useCallback, useEffect, useState } from "react";

import type { AuthSession } from "../../../services/authSession";
import {
  getTagSuggestions,
  searchPostsByTitle,
  searchUsers,
  type Post,
  type UserSearchResult,
} from "../../../services/homeApi";

type UseHomeSearchOptions = {
  selectedTag: string | null;
  session: AuthSession | null;
};

export function useHomeSearch({ selectedTag, session }: UseHomeSearchOptions) {
  const [tagQuery, setTagQuery] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<UserSearchResult[]>(
    [],
  );
  const [titleMatches, setTitleMatches] = useState<Post[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const clearSearch = useCallback(() => {
    setTagQuery("");
    setTagSuggestions([]);
    setUserSuggestions([]);
    setTitleMatches([]);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const query = tagQuery.trim();
    if (!query || selectedTag) {
      clearSearch();
      return;
    }

    async function loadSearchResults() {
      try {
        const [tags, users, posts] = await Promise.all([
          getTagSuggestions(query),
          searchUsers(query, session?.accessToken),
          searchPostsByTitle(query, session?.accessToken),
        ]);
        if (isMounted) {
          setTagSuggestions(tags);
          setUserSuggestions(users);
          setTitleMatches(posts.items);
        }
      } catch {
        if (isMounted) {
          setTagSuggestions([]);
          setUserSuggestions([]);
          setTitleMatches([]);
        }
      }
    }

    void loadSearchResults();
    return () => {
      isMounted = false;
    };
  }, [clearSearch, selectedTag, session?.accessToken, tagQuery]);

  return {
    clearSearch,
    isSearchFocused,
    setIsSearchFocused,
    setTagQuery,
    tagQuery,
    tagSuggestions,
    titleMatches,
    userSuggestions,
  };
}
