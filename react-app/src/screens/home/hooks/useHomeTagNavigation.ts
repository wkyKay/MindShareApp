import { useCallback, useEffect, useRef } from "react";

type UseHomeTagNavigationOptions = {
  selectedTag: string | null;
  clearSearch: () => void;
  onOpenTag: (tag: string) => void;
  refreshDiscover: (tagName?: string | null) => Promise<void>;
  resetDiscover: () => void;
  setContentMessage: (message: string) => void;
  setIsInitialLoading: (isLoading: boolean) => void;
  setSection: (section: "discover" | "following") => void;
};

export function useHomeTagNavigation({
  selectedTag,
  clearSearch,
  onOpenTag,
  refreshDiscover,
  resetDiscover,
  setContentMessage,
  setIsInitialLoading,
  setSection,
}: UseHomeTagNavigationOptions) {
  const lastAppliedTagRef = useRef<string | null>(selectedTag);

  const applyTag = useCallback(
    async (tagName: string | null) => {
      const normalized = tagName?.trim() || null;
      setSection("discover");
      clearSearch();
      resetDiscover();
      setIsInitialLoading(true);
      try {
        await refreshDiscover(normalized);
      } catch (error) {
        setContentMessage(
          error instanceof Error ? error.message : "内容加载失败",
        );
      } finally {
        setIsInitialLoading(false);
      }
    },
    [
      clearSearch,
      refreshDiscover,
      resetDiscover,
      setContentMessage,
      setIsInitialLoading,
      setSection,
    ],
  );

  useEffect(() => {
    if (selectedTag !== lastAppliedTagRef.current) {
      lastAppliedTagRef.current = selectedTag;
      void applyTag(selectedTag);
    }
  }, [applyTag, selectedTag]);

  const selectTag = useCallback(
    (tagName: string) => {
      onOpenTag(tagName);
      lastAppliedTagRef.current = tagName || null;
      void applyTag(tagName);
    },
    [applyTag, onOpenTag],
  );

  const clearTag = useCallback(() => {
    onOpenTag("");
    lastAppliedTagRef.current = null;
    void applyTag(null);
  }, [applyTag, onOpenTag]);

  return {
    clearTag,
    selectTag,
  };
}
