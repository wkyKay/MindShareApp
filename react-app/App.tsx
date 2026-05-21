import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';

import { BottomTabs, type Page } from './src/components/BottomTabs';
import { styles } from './src/components/styles';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { UploadScreen } from './src/screens/UploadScreen';

export default function App() {
  const [navigationStack, setNavigationStack] = useState<Page[]>(['home']);
  const page = navigationStack[navigationStack.length - 1];

  function navigate(pageName: Page) {
    setNavigationStack((currentStack) => [...currentStack, pageName]);
  }

  function switchTab(pageName: Page) {
    setNavigationStack([pageName]);
  }

  function goBack() {
    setNavigationStack((currentStack) => (currentStack.length > 1 ? currentStack.slice(0, -1) : currentStack));
  }

  return (
    <View style={styles.shell}>
      <View style={styles.app}>
        {page === 'home' && <HomeScreen />}
        {page === 'upload' && <UploadScreen onCancel={goBack} onSaved={() => switchTab('home')} />}
        {page === 'profile' && <ProfileScreen onOpenAuth={() => navigate('auth')} />}
        {page === 'auth' && <AuthScreen onBack={goBack} onDone={() => switchTab('profile')} />}

        <BottomTabs activePage={page} onChangePage={switchTab} />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}
