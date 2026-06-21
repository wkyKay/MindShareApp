import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import i18n from "../i18n";
import { StreamdownRN } from "streamdown-rn";
import type { StreamdownRNProps } from "streamdown-rn";

import { LazyImage } from "./LazyImage";
import { API_BASE_URL } from "../config/api";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppColors } from "../theme/colors";

type MarkdownTextProps = {
  children: string;
  style?: { body?: object };
};

type MarkdownPart =
  | { type: "markdown"; content: string }
  | { type: "image"; alt: string; uri: string }
  | { type: "ordered_list"; items: Array<{ marker: number; text: string }> }
  | { type: "bullet_list"; items: string[] };

type StreamdownTheme = Exclude<
  StreamdownRNProps["theme"],
  "dark" | "light" | undefined
>;

function createMarkdownTheme(colors: AppColors): StreamdownTheme {
  return {
    colors: {
      background: colors.background,
      foreground: colors.text,
      muted: colors.textSubtle,
      accent: colors.primary,
      codeBackground: colors.surfaceSoft,
      codeForeground: colors.text,
      border: colors.border,
      link: colors.primaryText,
      syntaxDefault: colors.text,
      syntaxKeyword: colors.primary,
      syntaxString: colors.warningText,
      syntaxNumber: colors.warningText,
      syntaxComment: colors.textSubtle,
      syntaxFunction: colors.primaryText,
      syntaxClass: colors.warningText,
      syntaxOperator: colors.text,
    },
    fonts: {
      mono: "Menlo",
    },
    spacing: {
      block: 12,
      inline: 4,
      indent: 12,
    },
  };
}

const fallbackMarkdownTheme: StreamdownTheme = {
  colors: {
    background: "#f5f5f5",
    foreground: "#3d302c",
    muted: "#8d7b75",
    accent: "#d94f70",
    codeBackground: "#2f2320",
    codeForeground: "#fef7f3",
    border: "#f0d7cf",
    link: "#a05d6f",
    syntaxDefault: "#fef7f3",
    syntaxKeyword: "#f4b5c4",
    syntaxString: "#a7e3bd",
    syntaxNumber: "#ffd799",
    syntaxComment: "#ccbcb7",
    syntaxFunction: "#9ed8ff",
    syntaxClass: "#fdd6a7",
    syntaxOperator: "#fef7f3",
  },
  fonts: {
    mono: "Menlo",
  },
  spacing: {
    block: 12,
    inline: 4,
    indent: 12,
  },
};

function normalizeMarkdownAssets(markdown: string) {
  return markdown.replace(
    /!\[([^\]]*)\]\(((?:\/uploads\/|uploads\/)[^)]+)\)/g,
    (_match, altText: string, relativeUrl: string) => {
      const normalized = relativeUrl.startsWith("/")
        ? relativeUrl
        : `/${relativeUrl}`;
      return `![${altText}](${API_BASE_URL}${normalized})`;
    },
  );
}

function splitMarkdownParts(markdown: string): MarkdownPart[] {
  const parts: MarkdownPart[] = [];
  const pendingLines: string[] = [];
  let orderedItems: Array<{ marker: number; text: string }> = [];
  let bulletItems: string[] = [];

  function flushMarkdown() {
    if (pendingLines.length > 0) {
      parts.push({ type: "markdown", content: pendingLines.join("\n") });
      pendingLines.length = 0;
    }
  }

  function flushLists() {
    if (orderedItems.length > 0) {
      parts.push({ type: "ordered_list", items: orderedItems });
      orderedItems = [];
    }
    if (bulletItems.length > 0) {
      parts.push({ type: "bullet_list", items: bulletItems });
      bulletItems = [];
    }
  }

  markdown.split("\n").forEach((line) => {
    const imageMatch = line.match(/^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    const orderedMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
    const bulletMatch = line.match(/^\s*[-*+]\s+(.+)$/);

    if (!imageMatch) {
      if (orderedMatch) {
        flushMarkdown();
        if (bulletItems.length > 0) {
          parts.push({ type: "bullet_list", items: bulletItems });
          bulletItems = [];
        }
        orderedItems.push({
          marker: Number(orderedMatch[1]),
          text: orderedMatch[2],
        });
        return;
      }
      if (bulletMatch) {
        flushMarkdown();
        if (orderedItems.length > 0) {
          parts.push({ type: "ordered_list", items: orderedItems });
          orderedItems = [];
        }
        bulletItems.push(bulletMatch[1]);
        return;
      }
      flushLists();
      pendingLines.push(line);
      return;
    }

    flushMarkdown();
    flushLists();
    parts.push({ type: "image", alt: imageMatch[1], uri: imageMatch[2] });
  });

  flushMarkdown();
  flushLists();

  return parts;
}

function MarkdownImage({ uri, alt }: { uri: string; alt?: string }) {
  const { colors } = useAppTheme();
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  return (
    <LazyImage
      uri={uri}
      resizeMode="contain"
      style={{
        width: "100%",
        aspectRatio,
        maxHeight: 420,
        borderRadius: 18,
        marginBottom: 12,
        backgroundColor: colors.surfaceSoft,
      }}
      accessibilityLabel={alt || i18n.t("图片")}
      onLoad={(event) => {
        const { width, height } = event.source;
        if (width && height) {
          setAspectRatio(width / height);
        }
      }}
    />
  );
}

function MarkdownList({
  part,
}: {
  part: Extract<MarkdownPart, { type: "ordered_list" | "bullet_list" }>;
}) {
  const { colors } = useAppTheme();
  const listTextStyle = {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  };

  if (part.type === "ordered_list") {
    return (
      <View style={{ marginBottom: 12 }}>
        {part.items.map((item, index) => (
          <View
            key={`${item.marker}-${index}`}
            style={{ flexDirection: "row", marginBottom: 6 }}
          >
            <Text
              style={{
                ...listTextStyle,
                width: 28,
              }}
            >
              {item.marker}.
            </Text>
            <Text
              style={{
                ...listTextStyle,
                flex: 1,
              }}
            >
              {item.text}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 12 }}>
      {part.items.map((item, index) => {
        return (
          <View
            key={`${item}-${index}`}
            style={{ flexDirection: "row", marginBottom: 6 }}
          >
            <Text
              style={{
                ...listTextStyle,
                width: 28,
              }}
            >
              •
            </Text>
            <Text
              style={{
                ...listTextStyle,
                flex: 1,
              }}
            >
              {item}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function MarkdownText({ children, style }: MarkdownTextProps) {
  const { colors } = useAppTheme();
  const markdownTheme = useMemo(() => createMarkdownTheme(colors), [colors]);
  const preparedContent = useMemo(
    () => normalizeMarkdownAssets(children || ""),
    [children],
  );
  const parts = useMemo(
    () => splitMarkdownParts(preparedContent),
    [preparedContent],
  );

  return (
    <View style={style?.body}>
      {parts.map((part, index) => {
        if (part.type === "image") {
          return (
            <MarkdownImage
              key={`${part.uri}-${index}`}
              uri={part.uri}
              alt={part.alt}
            />
          );
        }
        if (part.type === "ordered_list" || part.type === "bullet_list") {
          return <MarkdownList key={index} part={part} />;
        }
        if (!part.content.trim()) {
          return null;
        }
        return (
          <StreamdownRN
            key={index}
            theme={markdownTheme ?? fallbackMarkdownTheme}
            isComplete
          >
            {part.content}
          </StreamdownRN>
        );
      })}
    </View>
  );
}
