import { useCallback, useEffect, useState } from "react";

import type { AuthSession } from "../../../services/authSession";
import {
  getTagSuggestions,
  searchPostsByTitle,
  searchUsers,
  type Post,
  type UserSearchResult,
} from "../../../services/homeApi";

const SEARCH_DEBOUNCE_MS = 300;

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
    const controller = new AbortController();
    const query = tagQuery.trim();
    if (!query || selectedTag) {
      clearSearch();
      return;
    }

    const timer = setTimeout(() => {
      async function loadSearchResults() {
        try {
          const [tags, users, posts] = await Promise.all([
            getTagSuggestions(query, controller.signal),
            searchUsers(query, session?.accessToken, 5, controller.signal),
            searchPostsByTitle(query, session?.accessToken, 5, controller.signal),
          ]);
          if (isMounted) {
            setTagSuggestions(tags);
            setUserSuggestions(users);
            setTitleMatches(posts.items);
          }
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
          if (isMounted) {
            setTagSuggestions([]);
            setUserSuggestions([]);
            setTitleMatches([]);
          }
        }
      }

      void loadSearchResults();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timer);
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
