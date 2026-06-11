import { Pressable, Text, TextInput } from "react-native";

import type { AppStyles } from "../../components/styles";

type BlogEditFormProps = {
  title: string;
  body: string;
  textSubtleColor: string;
  onBack: () => void;
  onChangeTitle: (value: string) => void;
  onChangeBody: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function BlogEditForm({
  title,
  body,
  textSubtleColor,
  onBack,
  onChangeTitle,
  onChangeBody,
  onSave,
  onCancel,
  styles,
  t,
}: BlogEditFormProps) {
  return (
    <>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        placeholder={t("标题")}
        placeholderTextColor={textSubtleColor}
        value={title}
        onChangeText={onChangeTitle}
      />

      <TextInput
        multiline
        style={[styles.input, styles.bodyInput, styles.longBodyInput]}
        placeholder={t("正文")}
        placeholderTextColor={textSubtleColor}
        textAlignVertical="top"
        value={body}
        onChangeText={onChangeBody}
      />

      <Pressable style={styles.primaryButton} onPress={onSave}>
        <Text style={styles.primaryButtonText}>{t("保存修改")}</Text>
      </Pressable>
      <Pressable style={styles.draftButton} onPress={onCancel}>
        <Text style={styles.draftButtonText}>{t("取消编辑")}</Text>
      </Pressable>
    </>
  );
}
