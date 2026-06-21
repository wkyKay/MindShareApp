import { Text, TextInput, View } from "react-native";

import { MAX_POST_BODY_LENGTH } from "../../services/postApi";
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
  const bodyLength = body.length;
  const isOverLimit = bodyLength > MAX_POST_BODY_LENGTH;

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

      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Text
          style={{
            fontSize: 12,
            color: isOverLimit ? "#d94f70" : "#9a8f8a",
          }}
        >
          {bodyLength.toLocaleString()} / {MAX_POST_BODY_LENGTH.toLocaleString()}
          {isOverLimit ? ` (${t("已超出上限")})` : ""}
        </Text>
      </View>
    </>
  );
}
