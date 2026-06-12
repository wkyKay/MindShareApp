import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AuthModeTabs } from "../components/auth/AuthModeTabs";
import { CaptchaField } from "../components/auth/CaptchaField";
import { API_BASE_URL } from "../config/api";
import type { AuthMode } from "../services/authApi";
import type { AuthSession } from "../services/authSession";
import { useAuthForm } from "./auth/hooks/useAuthForm";
import { useTranslation } from "react-i18next";
import { useAppStyles } from "../theme/ThemeProvider";

type AuthScreenProps = {
  onBack: () => void;
  onDone: (session: AuthSession) => void;
};

export function AuthScreen({ onBack, onDone }: AuthScreenProps) {
  const styles = useAppStyles();
  const [mode, setMode] = useState<AuthMode>("login");
  const { t } = useTranslation();
  const {
    captcha,
    captchaTick,
    form,
    isLoading,
    isLogin,
    message,
    refreshCaptcha,
    setField,
    submitAuth,
  } = useAuthForm({ mode, onDone });

  return (
    <ScrollView contentContainerStyle={styles.authPageContent}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
      </Pressable>

      <View style={styles.authHero}>
        <Text style={styles.authEyebrow}>{t("博客小站账号")}</Text>
        <Text style={styles.authTitle}>
          {isLogin ? t("欢迎回来") : t("创建你的创作者身份")}
        </Text>
        <Text style={styles.authSubtitle}>
          {isLogin
            ? t("登录后继续发布、收藏和管理合集。")
            : t("注册后即可发布文字、图片博客并沉淀个人作品库。")}
        </Text>
      </View>

      <View style={styles.authCard}>
        <AuthModeTabs mode={mode} onChangeMode={setMode} />

        {!isLogin && (
          <>
            <TextInput
              style={styles.input}
              placeholder={t("用户名")}
              placeholderTextColor="#9a8f8a"
              autoCapitalize="none"
              value={form.username}
              onChangeText={(value) => setField("username", value)}
            />

            <TextInput
              style={styles.input}
              placeholder={t("展示昵称")}
              placeholderTextColor="#9a8f8a"
              value={form.displayName}
              onChangeText={(value) => setField("displayName", value)}
            />

            <TextInput
              style={styles.input}
              placeholder={t("邮箱")}
              placeholderTextColor="#9a8f8a"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(value) => setField("email", value)}
            />
          </>
        )}

        {isLogin && (
          <TextInput
            style={styles.input}
            placeholder={t("邮箱或用户名")}
            placeholderTextColor="#9a8f8a"
            autoCapitalize="none"
            value={form.account}
            onChangeText={(value) => setField("account", value)}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder={t("密码")}
          placeholderTextColor="#9a8f8a"
          secureTextEntry
          value={form.password}
          onChangeText={(value) => setField("password", value)}
        />

        {!isLogin && (
          <TextInput
            style={styles.input}
            placeholder={t("确认密码")}
            placeholderTextColor="#9a8f8a"
            secureTextEntry
            value={form.confirmPassword}
            onChangeText={(value) => setField("confirmPassword", value)}
          />
        )}

        <CaptchaField
          captcha={captcha}
          refreshCount={captchaTick}
          value={form.captchaCode}
          onChangeText={(value) => setField("captchaCode", value)}
          onRefresh={refreshCaptcha}
        />

        <Pressable
          style={[styles.primaryButton, isLoading && { opacity: 0.65 }]}
          onPress={submitAuth}
          disabled={isLoading}
        >
          <Text style={styles.primaryButtonText}>
            {isLoading ? t("提交中...") : isLogin ? t("登录") : t("注册并进入")}
          </Text>
        </Pressable>

        {!!message && (
          <Text style={[styles.authApiHint, { color: "#a05d6f" }]}>
            {message}
          </Text>
        )}

        <Text style={styles.authApiHint}>
          {t("当前连接")} {API_BASE_URL}/api/v1/auth/
          {isLogin ? "login" : "register"}
          {t("。真机调试时请确认手机和电脑在同一网络。")}
        </Text>
      </View>
    </ScrollView>
  );
}
