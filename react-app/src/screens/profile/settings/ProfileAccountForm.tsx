import { Text, TextInput, View } from "react-native";

import type { AppStyles } from "../../../components/styles";

type ProfileAccountFormProps = {
  username: string;
  email: string;
  displayName: string;
  bio: string;
  password: string;
  onChangeUsername: (value: string) => void;
  onChangeEmail: (value: string) => void;
  onChangeDisplayName: (value: string) => void;
  onChangeBio: (value: string) => void;
  onChangePassword: (value: string) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function ProfileAccountForm({
  username,
  email,
  displayName,
  bio,
  password,
  onChangeUsername,
  onChangeEmail,
  onChangeDisplayName,
  onChangeBio,
  onChangePassword,
  styles,
  t,
}: ProfileAccountFormProps) {
  return (
    <View style={styles.profileSettingsCard}>
      <Text style={styles.uploadTitle}>{t("账号信息")}</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={onChangeUsername}
        placeholder={t("用户名")}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={onChangeEmail}
        placeholder={t("邮箱")}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={onChangeDisplayName}
        placeholder={t("昵称")}
      />
      <TextInput
        style={[styles.input, styles.bodyInput]}
        value={bio}
        onChangeText={onChangeBio}
        placeholder={t("个人简介")}
        multiline
        textAlignVertical="top"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={onChangePassword}
        placeholder={t("新密码，留空则不修改")}
        secureTextEntry
      />
    </View>
  );
}
