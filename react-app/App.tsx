import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';

import { BottomTabs, type Page } from './src/components/BottomTabs';
import { styles } from './src/components/styles';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { UploadScreen } from './src/screens/UploadScreen';
import type { AuthSession } from './src/services/authSession';

export default function App() {
  const [navigationStack, setNavigationStack] = useState<Page[]>(['home']);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
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

  function finishAuth(session: AuthSession) {
    setAuthSession(session);
    setProfileRefreshKey((value) => value + 1);
    switchTab('profile');
  }

  function finishUpload() {
    setProfileRefreshKey((value) => value + 1);
    switchTab('profile');
  }

  return (
    <View style={styles.shell}>
      <View style={styles.app}>
        {page === 'home' && <HomeScreen />}
        {page === 'upload' && <UploadScreen session={authSession} onCancel={goBack} onSaved={finishUpload} />}
        {page === 'profile' && (
          <ProfileScreen
            initialSession={authSession}
            refreshKey={profileRefreshKey}
            onOpenAuth={() => navigate('auth')}
            onSessionChange={setAuthSession}
          />
        )}
        {page === 'auth' && <AuthScreen onBack={goBack} onDone={finishAuth} />}

        <BottomTabs activePage={page} onChangePage={switchTab} />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}
