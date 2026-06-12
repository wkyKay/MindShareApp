import { useEffect, useState } from "react";

import type { AuthSession } from "../../../services/authSession";
import { searchUsers, type SearchUserItem } from "../../../services/messagesApi";

export function useMessageSearch(session: AuthSession | null) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUserItem[]>([]);

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

  return {
    searchQuery,
    searchResults,
    setSearchQuery,
  };
}
