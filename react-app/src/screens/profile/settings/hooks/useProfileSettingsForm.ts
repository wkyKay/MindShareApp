import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";

import { updateMe } from "../../../../services/authApi";
import type { AuthSession } from "../../../../services/authSession";
import { uploadPostImage } from "../../../../services/postApi";

type UseProfileSettingsFormOptions = {
  currentSession: AuthSession | null;
  requireAuthSession: () => Promise<AuthSession | null>;
  setAuthSession: (session: AuthSession | null) => void;
  onRequireAuth: () => void;
};

export function useProfileSettingsForm({
  currentSession,
  requireAuthSession,
  setAuthSession,
  onRequireAuth,
}: UseProfileSettingsFormOptions) {
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

  useEffect(() => {
    setUsername(user?.username || "");
    setEmail(user?.email || "");
    setDisplayName(user?.display_name || "");
    setBio(user?.bio || "");
    setBackgroundUrl(user?.background_url || "");
    setBackgroundAssetId(null);
  }, [user]);

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

  return {
    backgroundUrl,
    bio,
    displayName,
    email,
    isSubmitting,
    message,
    password,
    pickBackground,
    setBio,
    setDisplayName,
    setEmail,
    setPassword,
    setUsername,
    submitProfile,
    username,
  };
}
