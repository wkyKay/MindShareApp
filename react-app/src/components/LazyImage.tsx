import { Image } from "expo-image";
import type { ImageProps } from "expo-image";
import type { ImageStyle, StyleProp } from "react-native";

type LazyImageProps = Omit<ImageProps, "source"> & {
  uri: string;
  thumbnailUri?: string;
  containerStyle?: StyleProp<ImageStyle>;
};

const blurhash = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

export function LazyImage({
  uri,
  thumbnailUri,
  containerStyle,
  style,
  ...props
}: LazyImageProps) {
  return (
    <Image
      {...props}
      source={{ uri }}
      placeholder={
        thumbnailUri ? { uri: thumbnailUri } : blurhash
      }
      transition={300}
      style={[style, containerStyle]}
      cachePolicy="memory-disk"
    />
  );
}
