import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import type { AuthSession } from "../../../services/authSession";
import { updateMe } from "../../../services/authApi";
import { uploadPostImage } from "../../../services/postApi";

type UseProfileAvatarOptions = {
  session: AuthSession;
  setAuthSession: (session: AuthSession | null) => void;
  setIsContentLoading: (isLoading: boolean) => void;
  setContentMessage: (message: string) => void;
};

export function useProfileAvatar({
  session,
  setAuthSession,
  setIsContentLoading,
  setContentMessage,
}: UseProfileAvatarOptions) {
  async function pickAvatar() {
    setContentMessage("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setContentMessage("需要相册权限才能设置头像。");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets.length) return;

    setIsContentLoading(true);
    try {
      const asset = result.assets[0];
      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 512, height: 512 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      const uploaded = await uploadPostImage(
        resized.uri,
        asset.fileName || `avatar-${Date.now()}.jpg`,
        session.accessToken,
        "avatar",
      );
      const updatedUser = await updateMe(
        { avatar_asset_id: uploaded.id },
        session.accessToken,
      );
      setAuthSession({ ...session, user: updatedUser });
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : "头像上传失败。");
    } finally {
      setIsContentLoading(false);
    }
  }

  return { pickAvatar };
}
