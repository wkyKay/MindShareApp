import { TextInput } from "react-native";

import type { AppStyles } from "../../components/styles";

type UploadEditorFieldsProps = {
  title: string;
  body: string;
  onChangeTitle: (value: string) => void;
  onChangeBody: (value: string) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function UploadEditorFields({
  title,
  body,
  onChangeTitle,
  onChangeBody,
  styles,
  t,
}: UploadEditorFieldsProps) {
  return (
    <>
      <TextInput
        style={styles.input}
        placeholder={t("标题")}
        placeholderTextColor="#9a8f8a"
        value={title}
        onChangeText={onChangeTitle}
      />

      <TextInput
        multiline
        style={[styles.input, styles.bodyInput, styles.longBodyInput]}
        placeholder={t(
          "写下正文，支持 Markdown，例如 # 标题、**加粗**、![图片](url)",
        )}
        placeholderTextColor="#9a8f8a"
        textAlignVertical="top"
        value={body}
        onChangeText={onChangeBody}
      />
    </>
  );
}
