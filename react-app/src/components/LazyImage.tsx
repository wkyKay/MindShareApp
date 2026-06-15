import { useState } from "react";
import {
  Image,
  View,
  type ImageProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useAppTheme } from "../theme/ThemeProvider";

type LazyImageProps = Omit<ImageProps, "source"> & {
  uri: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function LazyImage({
  uri,
  containerStyle,
  style,
  onLoad,
  onError,
  ...props
}: LazyImageProps) {
  const { colors } = useAppTheme();
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <View
      style={[
        { backgroundColor: colors.surfaceSoft, overflow: "hidden" },
        style as StyleProp<ViewStyle>,
        containerStyle,
      ]}
    >
      {!hasError ? (
        <Image
          {...props}
          source={{ uri }}
          style={[style, !isLoaded && { opacity: 0 }]}
          onLoad={(event) => {
            setIsLoaded(true);
            onLoad?.(event);
          }}
          onError={(event) => {
            setHasError(true);
            onError?.(event);
          }}
        />
      ) : null}
    </View>
  );
}
