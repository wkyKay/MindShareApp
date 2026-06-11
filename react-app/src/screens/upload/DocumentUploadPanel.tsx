import { Pressable, Text, View } from "react-native";

import type { AppStyles } from "../../components/styles";

type UploadedDocument = {
  id: number;
  name: string;
  url: string;
};

type DocumentUploadPanelProps = {
  documents: UploadedDocument[];
  onPickDocument: () => void;
  onParseTextDocument: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function DocumentUploadPanel({
  documents,
  onPickDocument,
  onParseTextDocument,
  styles,
  t,
}: DocumentUploadPanelProps) {
  return (
    <View style={styles.uploadBox}>
      <Text style={styles.uploadTitle}>{t("插入文件")}</Text>
      <Text style={styles.uploadHint}>
        {t(
          "支持 PDF、Word（.doc/.docx）和 Markdown（.md）。选择后会自动上传，并把文件链接插入正文；也可以把 .md/.docx 解析成正文。",
        )}
      </Text>
      <Pressable style={styles.secondaryButton} onPress={onPickDocument}>
        <Text style={styles.secondaryButtonText}>{t("选择文件")}</Text>
      </Pressable>
      <Pressable
        style={[styles.secondaryButton, styles.uploadStackedButton]}
        onPress={onParseTextDocument}
      >
        <Text style={styles.secondaryButtonText}>
          {t("解析 Markdown/Word 到正文")}
        </Text>
      </Pressable>
      {documents.length > 0 ? (
        <View style={styles.documentList}>
          {documents.map((document) => (
            <Text key={document.id} style={styles.documentListItem}>
              {t("附件：")}
              {document.name}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
