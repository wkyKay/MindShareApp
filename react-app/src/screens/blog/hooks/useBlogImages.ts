import { useCallback, useState } from "react";

export function useBlogImages() {
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const handleImageRatio = useCallback((imageUrl: string, ratio: number) => {
    setImageRatios((current) =>
      current[imageUrl] === ratio ? current : { ...current, [imageUrl]: ratio },
    );
  }, []);

  return {
    handleImageRatio,
    imageRatios,
    previewImageUrl,
    setPreviewImageUrl,
  };
}
