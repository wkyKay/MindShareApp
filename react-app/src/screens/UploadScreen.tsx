import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { styles } from '../components/styles';

type UploadScreenProps = {
  onCancel: () => void;
  onSaved: () => void;
};

export function UploadScreen({ onCancel, onSaved }: UploadScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <View style={styles.pageHeaderRow}>
        <Pressable style={styles.backButtonCompact} onPress={onCancel}>
          <Text style={styles.backButtonText}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.pageTitle}>发布博客</Text>
      </View>
      <TextInput style={styles.input} placeholder="标题" placeholderTextColor="#9a8f8a" />
      <TextInput
        multiline
        style={[styles.input, styles.bodyInput]}
        placeholder="写下正文，或稍后从 Word / PDF / Markdown 解析文字"
        placeholderTextColor="#9a8f8a"
        textAlignVertical="top"
      />
      <View style={styles.uploadBox}>
        <Text style={styles.uploadTitle}>图片上传</Text>
        <Text style={styles.uploadHint}>占位功能：后续接入图片选择和上传</Text>
      </View>
      <View style={styles.uploadBox}>
        <Text style={styles.uploadTitle}>文档文字解析</Text>
        <Text style={styles.uploadHint}>支持 .doc / .docx / .pdf / .md，后续由后端解析文字</Text>
      </View>
      <Pressable style={styles.primaryButton} onPress={onSaved}>
        <Text style={styles.primaryButtonText}>保存草稿</Text>
      </Pressable>
    </ScrollView>
  );
}
