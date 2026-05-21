import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles';
import type { AuthMode } from '../../services/authApi';

type AuthModeTabsProps = {
  mode: AuthMode;
  onChangeMode: (mode: AuthMode) => void;
};

export function AuthModeTabs({ mode, onChangeMode }: AuthModeTabsProps) {
  const isLogin = mode === 'login';

  return (
    <View style={styles.segmentedControl}>
      <Pressable style={[styles.segmentButton, isLogin && styles.segmentButtonActive]} onPress={() => onChangeMode('login')}>
        <Text style={[styles.segmentText, isLogin && styles.segmentTextActive]}>登录</Text>
      </Pressable>
      <Pressable style={[styles.segmentButton, !isLogin && styles.segmentButtonActive]} onPress={() => onChangeMode('register')}>
        <Text style={[styles.segmentText, !isLogin && styles.segmentTextActive]}>注册</Text>
      </Pressable>
    </View>
  );
}
