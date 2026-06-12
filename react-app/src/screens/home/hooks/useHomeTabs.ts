import { useCallback, useState } from "react";

export type HomeSection = "discover" | "following";

export function useHomeTabs() {
  const [section, setSection] = useState<HomeSection>("discover");
  const isDiscover = section === "discover";
  const tabIndex = isDiscover ? 0 : 1;

  const switchSection = useCallback((nextSection: HomeSection) => {
    setSection(nextSection);
  }, []);

  return {
    isDiscover,
    section,
    setSection,
    switchSection,
    tabIndex,
  };
}
