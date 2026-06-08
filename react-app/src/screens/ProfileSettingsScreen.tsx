import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";

import { updateMe } from "../services/authApi";
import type { AuthSession } from "../services/authSession";
import { uploadPostImage } from "../services/postApi";
import { changeAppLanguage, type SupportedLanguage } from "../i18n";
import { useAuthStore } from "../stores/authStore";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppThemeMode } from "../theme/colors";

type ProfileSettingsScreenProps = {
  session: AuthSession | null;
  onBack: () => void;
  onRequireAuth: () => void;
};

export function ProfileSettingsScreen({
  session,
  onBack,
  onRequireAuth,
}: ProfileSettingsScreenProps) {
  const { mode, setMode, styles } = useAppTheme();
  const { i18n, t } = useTranslation();
  const storeSession = useAuthStore((state) => state.session);
  const requireAuthSession = useAuthStore((state) => state.requireSession);
  const setAuthSession = useAuthStore((state) => state.setSession);
  const currentSession = storeSession ?? session;
  const user = currentSession?.user;
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [password, setPassword] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState(user?.background_url || "");
  const [backgroundAssetId, setBackgroundAssetId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function pickBackground() {
    setMessage("");
    const activeSession = currentSession ?? (await requireAuthSession());
    if (!activeSession) {
      onRequireAuth();
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage("需要相册权限才能设置背景图。");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets.length) return;

    setIsSubmitting(true);
    try {
      const asset = result.assets[0];
      const uploaded = await uploadPostImage(
        asset.uri,
        asset.fileName || `profile-background-${Date.now()}.jpg`,
        activeSession.accessToken,
        "cover",
      );
      if (!uploaded.url) {
        throw new Error("图片上传成功，但未返回可访问地址。");
      }
      setBackgroundAssetId(uploaded.id);
      setBackgroundUrl(uploaded.url);
      setMessage("背景图已选择，保存后生效。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "背景图上传失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitProfile() {
    setMessage("");
    const activeSession = currentSession ?? (await requireAuthSession());
    if (!activeSession) {
      onRequireAuth();
      return;
    }
    if (!username.trim() || !email.trim() || !displayName.trim()) {
      setMessage("用户名、邮箱和昵称不能为空。");
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedUser = await updateMe(
        {
          username: username.trim(),
          email: email.trim(),
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          ...(password.trim() ? { password: password.trim() } : {}),
          ...(backgroundAssetId ? { background_asset_id: backgroundAssetId } : {}),
        },
        activeSession.accessToken,
      );
      setAuthSession({ ...activeSession, user: updatedUser });
      setPassword("");
      setMessage("个人信息已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "个人信息保存失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function selectLanguage(language: SupportedLanguage) {
    await changeAppLanguage(language);
  }

  async function selectThemeMode(themeMode: AppThemeMode) {
    await setMode(themeMode);
  }

  if (!currentSession) {
    return (
      <ScrollView contentContainerStyle={styles.pageContent}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{t("个人设置")}</Text>
        <Text style={styles.profileBio}>{t("请先登录后再修改个人信息。")}</Text>
        <Pressable style={styles.primaryButton} onPress={onRequireAuth}>
          <Text style={styles.primaryButtonText}>{t("去登录")}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
      </Pressable>
      <Text style={styles.pageTitle}>{t("个人设置")}</Text>
      <Text style={styles.profileBio}>{t("修改账号资料、密码和个人主页背景图。")}</Text>

      <View style={styles.profileSettingsCard}>
        <Text style={styles.uploadTitle}>{t("主页背景图")}</Text>
        {backgroundUrl ? (
          <Image source={{ uri: backgroundUrl }} style={styles.profileBackgroundPreview} />
        ) : (
          <View style={styles.profileBackgroundPlaceholder}>
            <Text style={styles.profileBio}>{t("暂无背景图")}</Text>
          </View>
        )}
        <Pressable style={styles.secondaryButton} onPress={pickBackground}>
          <Text style={styles.secondaryButtonText}>{t("选择背景图")}</Text>
        </Pressable>
      </View>

      <View style={styles.profileSettingsCard}>
        <Text style={styles.uploadTitle}>{t("账号信息")}</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder={t("用户名")}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t("邮箱")}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t("昵称")}
        />
        <TextInput
          style={[styles.input, styles.bodyInput]}
          value={bio}
          onChangeText={setBio}
          placeholder={t("个人简介")}
          multiline
          textAlignVertical="top"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t("新密码，留空则不修改")}
          secureTextEntry
        />
      </View>

      <View style={styles.profileSettingsCard}>
        <Text style={styles.uploadTitle}>{t("语言")}</Text>
        <View style={styles.languageOptionList}>
          <Pressable
            style={[
              styles.languageOptionButton,
              i18n.language === "zh-CN" && styles.languageOptionButtonActive,
            ]}
            onPress={() => void selectLanguage("zh-CN")}
          >
            <Text
              style={[
                styles.languageOptionText,
                i18n.language === "zh-CN" && styles.languageOptionTextActive,
              ]}
            >
              {t("中文")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.languageOptionButton,
              i18n.language === "en-US" && styles.languageOptionButtonActive,
            ]}
            onPress={() => void selectLanguage("en-US")}
          >
            <Text
              style={[
                styles.languageOptionText,
                i18n.language === "en-US" && styles.languageOptionTextActive,
              ]}
            >
              {t("profile.languageEnglish")}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.profileSettingsCard}>
        <Text style={styles.uploadTitle}>{t("外观")}</Text>
        <View style={styles.languageOptionList}>
          {(
            [
              ["system", t("跟随系统")],
              ["light", t("浅色")],
              ["dark", t("深色")],
            ] as const
          ).map(([themeMode, label]) => (
            <Pressable
              key={themeMode}
              style={[
                styles.languageOptionButton,
                mode === themeMode && styles.languageOptionButtonActive,
              ]}
              onPress={() => void selectThemeMode(themeMode)}
            >
              <Text
                style={[
                  styles.languageOptionText,
                  mode === themeMode && styles.languageOptionTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={submitProfile}
        disabled={isSubmitting}
      >
        <Text style={styles.primaryButtonText}>
          {isSubmitting ? t("保存中...") : t("保存修改")}
        </Text>
      </Pressable>
      {message ? <Text style={styles.authApiHint}>{message}</Text> : null}
    </ScrollView>
  );
}
