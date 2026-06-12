import { useState } from "react";

export function useUploadTags() {
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  function addTag() {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) {
      setTagInput("");
      return;
    }
    setTags((currentTags) => [...currentTags, tag]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((currentTags) => currentTags.filter((item) => item !== tag));
  }

  return {
    addTag,
    removeTag,
    setTagInput,
    tagInput,
    tags,
  };
}
