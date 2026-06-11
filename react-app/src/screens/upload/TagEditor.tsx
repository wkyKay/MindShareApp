import { Pressable, Text, TextInput, View } from "react-native";

import type { AppStyles } from "../../components/styles";

type TagEditorProps = {
  tagInput: string;
  tags: string[];
  onChangeTagInput: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function TagEditor({
  tagInput,
  tags,
  onChangeTagInput,
  onAddTag,
  onRemoveTag,
  styles,
  t,
}: TagEditorProps) {
  return (
    <View style={styles.tagPanel}>
      <Text style={styles.uploadTitle}>{t("添加 Tag")}</Text>
      <View style={styles.tagInputRow}>
        <TextInput
          style={styles.tagInput}
          placeholder={t("输入标签")}
          placeholderTextColor="#9a8f8a"
          value={tagInput}
          onChangeText={onChangeTagInput}
          onSubmitEditing={onAddTag}
        />

        <Pressable style={styles.tagAddButton} onPress={onAddTag}>
          <Text style={styles.tagAddButtonText}>{t("增加")}</Text>
        </Pressable>
      </View>
      {tags.length > 0 ? (
        <View style={styles.tagList}>
          {tags.map((tag) => (
            <Pressable
              key={tag}
              style={styles.tagChip}
              onPress={() => onRemoveTag(tag)}
            >
              <Text style={styles.tagChipText}>#{tag} ×</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
