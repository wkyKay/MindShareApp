import { Pressable, Text, TextInput, View } from 'react-native';

import { styles } from '../../components/styles';
import type { ProfileCollection } from '../../services/profileApi';

type CollectionFormProps = {
  isOpen: boolean;
  editingCollection: ProfileCollection | null;
  title: string;
  description: string;
  onOpen: () => void;
  onChangeTitle: (title: string) => void;
  onChangeDescription: (description: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function CollectionForm({ isOpen, editingCollection, title, description, onOpen, onChangeTitle, onChangeDescription, onCancel, onSubmit }: CollectionFormProps) {
  return (
    <View style={styles.authPromptCard}>
      {!isOpen ? (
        <Pressable style={[styles.actionButton, styles.actionButtonActive]} onPress={onOpen}>
          <Text style={styles.actionButtonText}>创建合集</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.authPromptTitle}>{editingCollection ? '编辑合集' : '创建合集'}</Text>
          <TextInput style={styles.input} placeholder="合集名称" placeholderTextColor="#a89994" value={title} onChangeText={onChangeTitle} />
          <TextInput
            style={[styles.input, { minHeight: 90 }]}
            multiline
            placeholder="添加描述，让读者知道这个文件夹的主题"
            placeholderTextColor="#a89994"
            value={description}
            onChangeText={onChangeDescription}
          />
          <View style={styles.actionRow}>
            <Pressable style={styles.actionButton} onPress={onCancel}>
              <Text style={styles.actionButtonText}>取消</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.actionButtonActive]} onPress={onSubmit}>
              <Text style={styles.actionButtonText}>{editingCollection ? '保存合集' : '创建合集'}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
