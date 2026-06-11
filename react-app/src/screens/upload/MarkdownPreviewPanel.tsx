import { Text, View } from "react-native";

import { MarkdownText } from "../../components/MarkdownText";
import type { AppStyles } from "../../components/styles";

type MarkdownPreviewPanelProps = {
  renderedMarkdown: string;
  rawDraft: string;
  styles: AppStyles;
  t: (key: string) => string;
};

export function MarkdownPreviewPanel({
  renderedMarkdown,
  rawDraft,
  styles,
  t,
}: MarkdownPreviewPanelProps) {
  return (
    <View style={styles.uploadPreviewPanel}>
      <Text style={styles.uploadTitle}>{t("渲染预览")}</Text>
      {renderedMarkdown.trim() || rawDraft.trim() ? (
        <>
          {renderedMarkdown.trim() ? (
            <View style={styles.renderedParagraphCard}>
              <MarkdownText>{renderedMarkdown}</MarkdownText>
            </View>
          ) : null}
          {rawDraft.trim() ? (
            <View style={styles.editingParagraphCard}>
              <Text style={styles.rawPreviewText}>{rawDraft}</Text>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.uploadHint}>
          {t("上方输入 Markdown 后，这里会实时显示渲染效果。")}
        </Text>
      )}
    </View>
  );
}
