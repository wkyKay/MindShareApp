import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';

import { BottomTabs, type Page } from './src/components/BottomTabs';
import { styles } from './src/components/styles';
import { AuthScreen } from './src/screens/AuthScreen';
import { BlogScreen } from './src/screens/BlogScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { UploadScreen } from './src/screens/UploadScreen';
import type { AuthSession } from './src/services/authSession';
import { AuthorScreen } from './src/screens/AuthorScreen';

type RootStackParamList = {
  home: { tag?: string } | undefined;
  upload: undefined;
  profile: undefined;
  auth: undefined;
  blog: { postId: number };
  author: { authorId: number };
};

type AppScreenProps<RouteName extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, RouteName>;

const Stack = createNativeStackNavigator<RootStackParamList>();
const tabPages = new Set<string>(['home', 'upload', 'profile']);
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [activePage, setActivePage] = useState<keyof RootStackParamList>('home');

  const updateSession = useCallback((session: AuthSession | null) => {
    setAuthSession(session);
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={(state) => {
        const routeName = state?.routes[state.index]?.name;
        if (routeName) {
          setActivePage(routeName as Page);
        }
      }}
    >
      <View style={styles.shell}>
        <View style={styles.app}>
          <Stack.Navigator initialRouteName="home" screenOptions={{ headerShown: false }}>
            
            <Stack.Screen name="home">
              {({ navigation, route }: AppScreenProps<'home'>) => (
                <HomeScreen
                  session={authSession}
                  selectedRouteTag={route.params?.tag}
                  onOpenPost={(postId) => navigation.navigate('blog', { postId })}
                  onOpenTag={(tag) => navigation.navigate('home', { tag: tag || undefined })}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="upload">
              {({ navigation }: AppScreenProps<'upload'>) => (
                <UploadScreen
                  session={authSession}
                  onCancel={() => navigation.goBack()}
                  onSaved={() => {
                    navigation.navigate('profile');
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="profile">
              {({ navigation }: AppScreenProps<'profile'>) => (
                <ProfileScreen
                  initialSession={authSession}
                  onOpenAuth={() => navigation.navigate('auth')}
                  onOpenPost={(postId) => navigation.navigate('blog', { postId })}
                  onOpenAuthor={(authorId) => navigation.navigate('author', { authorId })}
                  onOpenTag={(tag) => navigation.navigate('home', { tag })}
                  onSessionChange={updateSession}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="auth">
              {({ navigation }: AppScreenProps<'auth'>) => (
                <AuthScreen
                  onBack={() => navigation.goBack()}
                  onDone={(session) => {
                    setAuthSession(session);
                    navigation.navigate('profile');
                  }}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="blog">
              {({ navigation, route }: AppScreenProps<'blog'>) => (
                <BlogScreen
                  postId={route.params.postId}
                  session={authSession}
                  onBack={() => navigation.goBack()}
                  onDeleted={() => {
                    navigation.navigate('profile');
                  }}
                  onRequireAuth={() => navigation.navigate('auth')}
                  onOpenAuthor={(authorId) => navigation.navigate('author', { authorId })}
                  onOpenTag={(tag) => navigation.navigate('home', { tag })}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="author">
              {({ navigation, route }: AppScreenProps<'author'>) => (
                <AuthorScreen
                  onBack={() => navigation.goBack()}
                  author_id={route.params.authorId}
                  session={authSession}
                  onRequireAuth={() => navigation.navigate('auth')}
                  onOpenPost={(postId) => navigation.navigate('blog', { postId })}
                  onOpenTag={(tag) => navigation.navigate('home', { tag })}
                />
              )}
            </Stack.Screen>

          </Stack.Navigator>
          {tabPages.has(activePage) && (
            <BottomTabs
              activePage={activePage as Exclude<Page, 'auth'>}
              onChangePage={(page) => {
                if (navigationRef.isReady()) {
                  navigationRef.navigate(page);
                }
              }}
            />
          )}
        </View>
        <StatusBar style="auto" />
      </View>
    </NavigationContainer>
  );
}
