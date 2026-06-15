import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { useAppTheme } from "../theme/ThemeProvider";

type PageErrorBoundaryProps = {
  children: ReactNode;
  fallbackTitle: string;
  retryLabel: string;
  resetKey?: string | number;
};

type PageErrorBoundaryState = {
  hasError: boolean;
};

class PageErrorBoundaryBase extends Component<
  PageErrorBoundaryProps & ReturnType<typeof useAppTheme>,
  PageErrorBoundaryState
> {
  state: PageErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Page render failed", error, errorInfo);
  }

  componentDidUpdate(previousProps: PageErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { colors, fallbackTitle, retryLabel, styles } = this.props;
    return (
      <View style={[styles.pageContent, { flex: 1, justifyContent: "center" }]}>
        <Text style={[styles.pageTitle, { textAlign: "center" }]}>
          {fallbackTitle}
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => this.setState({ hasError: false })}
        >
          <Text style={[styles.primaryButtonText, { color: colors.surface }]}> 
            {retryLabel}
          </Text>
        </Pressable>
      </View>
    );
  }
}

export function PageErrorBoundary(props: PageErrorBoundaryProps) {
  const theme = useAppTheme();
  return <PageErrorBoundaryBase {...props} {...theme} />;
}
