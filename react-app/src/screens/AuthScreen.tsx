import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { styles } from '../components/styles';

type AuthMode = 'login' | 'register';

type AuthScreenProps = {
  onBack: () => void;
  onDone: () => void;
};

export function AuthScreen({ onBack, onDone }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [captchaTick, setCaptchaTick] = useState(1);
  const isLogin = mode === 'login';

  return (
    <ScrollView contentContainerStyle={styles.authPageContent}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>‹ 返回</Text>
      </Pressable>

      <View style={styles.authHero}>
        <Text style={styles.authEyebrow}>同人小站账号</Text>
        <Text style={styles.authTitle}>{isLogin ? '欢迎回来' : '创建你的创作者身份'}</Text>
        <Text style={styles.authSubtitle}>
          {isLogin ? '登录后继续发布、收藏和管理合集。' : '注册后即可发布文字、图片博客并沉淀个人作品库。'}
        </Text>
      </View>

      <View style={styles.authCard}>
        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentButton, isLogin && styles.segmentButtonActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.segmentText, isLogin && styles.segmentTextActive]}>登录</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentButton, !isLogin && styles.segmentButtonActive]}
            onPress={() => setMode('register')}
          >
            <Text style={[styles.segmentText, !isLogin && styles.segmentTextActive]}>注册</Text>
          </Pressable>
        </View>

        {!isLogin && (
          <>
            <TextInput style={styles.input} placeholder="用户名" placeholderTextColor="#9a8f8a" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="展示昵称" placeholderTextColor="#9a8f8a" />
            <TextInput
              style={styles.input}
              placeholder="邮箱"
              placeholderTextColor="#9a8f8a"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </>
        )}

        {isLogin && (
          <TextInput
            style={styles.input}
            placeholder="邮箱或用户名"
            placeholderTextColor="#9a8f8a"
            autoCapitalize="none"
          />
        )}

        <TextInput style={styles.input} placeholder="密码" placeholderTextColor="#9a8f8a" secureTextEntry />
        {!isLogin && <TextInput style={styles.input} placeholder="确认密码" placeholderTextColor="#9a8f8a" secureTextEntry />}

        <View style={styles.captchaRow}>
          <TextInput style={styles.captchaInput} placeholder="验证码" placeholderTextColor="#9a8f8a" autoCapitalize="characters" />
          <Pressable style={styles.captchaImage} onPress={() => setCaptchaTick((value) => value + 1)}>
            <Text style={styles.captchaCode}>{isLogin ? '8K3P' : 'F7M2'}</Text>
            <Text style={styles.captchaHint}>换一张 #{captchaTick}</Text>
          </Pressable>
        </View>

        <Pressable style={styles.primaryButton} onPress={onDone}>
          <Text style={styles.primaryButtonText}>{isLogin ? '登录' : '注册并进入'}</Text>
        </Pressable>

        <Text style={styles.authApiHint}>
          验证码将对接 GET /api/v1/auth/captcha，提交时分别调用 /api/v1/auth/{isLogin ? 'login' : 'register'}。
        </Text>
      </View>
    </ScrollView>
  );
}
