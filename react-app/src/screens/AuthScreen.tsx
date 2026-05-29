import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AuthModeTabs } from '../components/auth/AuthModeTabs';
import { CaptchaField } from '../components/auth/CaptchaField';
import { styles } from '../components/styles';
import { API_BASE_URL } from '../config/api';
import { getCaptcha, login, register, type AuthMode, type CaptchaResponse } from '../services/authApi';
import type { AuthSession } from '../services/authSession';
import { useAuthStore } from '../stores/authStore';

type AuthScreenProps = {
  onBack: () => void;
  onDone: (session: AuthSession) => void;
};

export function AuthScreen({ onBack, onDone }: AuthScreenProps) {
  const setAuthFromToken = useAuthStore((state) => state.setFromToken);
  const [mode, setMode] = useState<AuthMode>('login');
  const [captchaTick, setCaptchaTick] = useState(1);
  const [captcha, setCaptcha] = useState<CaptchaResponse | null>(null);
  const [account, setAccount] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isLogin = mode === 'login';

  useEffect(() => {
    let isMounted = true;

    async function loadCaptcha() {
      setCaptcha(null);
      setCaptchaCode('');

      try {
        const data = await getCaptcha(mode);
        if (isMounted) {
          setCaptcha(data);
        }
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : '验证码加载失败，请确认后端服务已启动。');
        }
      }
    }

    void loadCaptcha();

    return () => {
      isMounted = false;
    };
  }, [mode, captchaTick]);

  async function submitAuth() {
    setMessage('');

    if (!captcha) {
      setMessage('验证码尚未加载完成。');
      return;
    }
    if (!password || !captchaCode.trim()) {
      setMessage('请填写密码和验证码。');
      return;
    }
    if (isLogin && !account.trim()) {
      setMessage('请填写邮箱或用户名。');
      return;
    }
    if (!isLogin) {
      if (!username.trim() || !displayName.trim() || !email.trim()) {
        setMessage('请填写用户名、展示昵称和邮箱。');
        return;
      }
      if (password.length < 8) {
        setMessage('密码至少需要 8 位。');
        return;
      }
      if (password !== confirmPassword) {
        setMessage('两次输入的密码不一致。');
        return;
      }
    }

    setIsLoading(true);
    try {
      const data = isLogin
        ? await login({
            account: account.trim(),
            password,
            captcha_key: captcha.captcha_key,
            captcha_code: captchaCode.trim(),
          })
        : await register({
            username: username.trim(),
            display_name: displayName.trim(),
            email: email.trim(),
            password,
            captcha_key: captcha.captcha_key,
            captcha_code: captchaCode.trim(),
          });
      const session = await setAuthFromToken(data);
      setMessage(`${session.user.display_name}，欢迎进入创作者空间。`);
      onDone(session);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '认证失败，请稍后重试。');
      setCaptchaTick((value) => value + 1);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.authPageContent}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>‹ 返回</Text>
      </Pressable>

      <View style={styles.authHero}>
        <Text style={styles.authEyebrow}>博客小站账号</Text>
        <Text style={styles.authTitle}>{isLogin ? '欢迎回来' : '创建你的创作者身份'}</Text>
        <Text style={styles.authSubtitle}>
          {isLogin ? '登录后继续发布、收藏和管理合集。' : '注册后即可发布文字、图片博客并沉淀个人作品库。'}
        </Text>
      </View>

      <View style={styles.authCard}>
        <AuthModeTabs mode={mode} onChangeMode={setMode} />

        {!isLogin && (
          <>
            <TextInput
              style={styles.input}
              placeholder="用户名"
              placeholderTextColor="#9a8f8a"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
            <TextInput
              style={styles.input}
              placeholder="展示昵称"
              placeholderTextColor="#9a8f8a"
              value={displayName}
              onChangeText={setDisplayName}
            />
            <TextInput
              style={styles.input}
              placeholder="邮箱"
              placeholderTextColor="#9a8f8a"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </>
        )}

        {isLogin && (
          <TextInput
            style={styles.input}
            placeholder="邮箱或用户名"
            placeholderTextColor="#9a8f8a"
            autoCapitalize="none"
            value={account}
            onChangeText={setAccount}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="密码"
          placeholderTextColor="#9a8f8a"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {!isLogin && (
          <TextInput
            style={styles.input}
            placeholder="确认密码"
            placeholderTextColor="#9a8f8a"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        )}

        <CaptchaField
          captcha={captcha}
          refreshCount={captchaTick}
          value={captchaCode}
          onChangeText={setCaptchaCode}
          onRefresh={() => setCaptchaTick((value) => value + 1)}
        />

        <Pressable
          style={[styles.primaryButton, isLoading && { opacity: 0.65 }]}
          onPress={submitAuth}
          disabled={isLoading}
        >
          <Text style={styles.primaryButtonText}>{isLoading ? '提交中...' : isLogin ? '登录' : '注册并进入'}</Text>
        </Pressable>

        {!!message && <Text style={[styles.authApiHint, { color: '#a05d6f' }]}>{message}</Text>}

        <Text style={styles.authApiHint}>
          当前连接 {API_BASE_URL}/api/v1/auth/{isLogin ? 'login' : 'register'}。真机调试时请确认手机和电脑在同一网络。
        </Text>
      </View>
    </ScrollView>
  );
}
