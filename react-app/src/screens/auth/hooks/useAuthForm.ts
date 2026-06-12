import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getCaptcha,
  login,
  register,
  type AuthMode,
  type CaptchaResponse,
} from "../../../services/authApi";
import type { AuthSession } from "../../../services/authSession";
import { useAuthStore } from "../../../stores/authStore";

type AuthFormValues = {
  account: string;
  username: string;
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  captchaCode: string;
};

type AuthFormField = keyof AuthFormValues;

type UseAuthFormOptions = {
  mode: AuthMode;
  onDone: (session: AuthSession) => void;
};

const initialForm: AuthFormValues = {
  account: "",
  username: "",
  displayName: "",
  email: "",
  password: "",
  confirmPassword: "",
  captchaCode: "",
};

export function useAuthForm({ mode, onDone }: UseAuthFormOptions) {
  const setAuthFromToken = useAuthStore((state) => state.setFromToken);
  const [captchaTick, setCaptchaTick] = useState(1);
  const [captcha, setCaptcha] = useState<CaptchaResponse | null>(null);
  const [form, setForm] = useState<AuthFormValues>(initialForm);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isLogin = mode === "login";
  const { t } = useTranslation();

  const setField = useCallback((field: AuthFormField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const refreshCaptcha = useCallback(() => {
    setCaptchaTick((value) => value + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadCaptcha() {
      setCaptcha(null);
      setField("captchaCode", "");

      try {
        const data = await getCaptcha(mode);
        if (isMounted) {
          setCaptcha(data);
        }
      } catch (error) {
        if (isMounted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "验证码加载失败，请确认后端服务已启动。",
          );
        }
      }
    }

    void loadCaptcha();

    return () => {
      isMounted = false;
    };
  }, [mode, captchaTick, setField]);

  const submitAuth = useCallback(async () => {
    setMessage("");

    if (!captcha) {
      setMessage("验证码尚未加载完成。");
      return;
    }
    if (!form.password || !form.captchaCode.trim()) {
      setMessage("请填写密码和验证码。");
      return;
    }
    if (isLogin && !form.account.trim()) {
      setMessage("请填写邮箱或用户名。");
      return;
    }
    if (!isLogin) {
      if (!form.username.trim() || !form.displayName.trim() || !form.email.trim()) {
        setMessage("请填写用户名、展示昵称和邮箱。");
        return;
      }
      if (form.password.length < 8) {
        setMessage("密码至少需要 8 位。");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setMessage("两次输入的密码不一致。");
        return;
      }
    }

    setIsLoading(true);
    try {
      const data = isLogin
        ? await login({
            account: form.account.trim(),
            password: form.password,
            captcha_key: captcha.captcha_key,
            captcha_code: form.captchaCode.trim(),
          })
        : await register({
            username: form.username.trim(),
            display_name: form.displayName.trim(),
            email: form.email.trim(),
            password: form.password,
            captcha_key: captcha.captcha_key,
            captcha_code: form.captchaCode.trim(),
          });
      const session = await setAuthFromToken(data);
      setMessage(
        t("{{displayName}}，欢迎进入创作者空间。", {
          displayName: session.user.display_name,
        }),
      );
      onDone(session);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "认证失败，请稍后重试。",
      );
      refreshCaptcha();
    } finally {
      setIsLoading(false);
    }
  }, [captcha, form, isLogin, onDone, refreshCaptcha, setAuthFromToken, t]);

  return {
    captcha,
    captchaTick,
    form,
    isLoading,
    isLogin,
    message,
    refreshCaptcha,
    setField,
    submitAuth,
  };
}
