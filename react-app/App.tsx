import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createNavigationContainerRef, NavigationContainer, type NavigationProp } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';

import { BottomTabs, type Page } from './src/components/BottomTabs';
import { styles } from './src/components/styles';
import { AuthScreen } from './src/screens/AuthScreen';
import { BlogScreen } from './src/screens/BlogScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { NotificationScreen } from './src/screens/NotificationScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { UploadScreen } from './src/screens/UploadScreen';
import { AuthorScreen } from './src/screens/AuthorScreen';
import { useAuthStore } from './src/stores/authStore';
import { useNotificationStore } from './src/stores/notificationStore';

type RootStackParamList = {
  home: { tag?: string } | undefined;
  upload: undefined;
  notifications: undefined;
  profile: undefined;
  auth: undefined;
  blog: { postId: number };
  author: { authorId: number };
};

type AppScreenProps<RouteName extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, RouteName>;

const Stack = createNativeStackNavigator<RootStackParamList>();
const tabPages = new Set<string>(['home', 'upload', 'notifications', 'profile']);
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  const [activePage, setActivePage] = useState<keyof RootStackParamList>('home');
  const authSession = useAuthStore((state) => state.session);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrateNotifications = useNotificationStore((state) => state.hydrate);

  function openAuthorProfileAware(navigation: NavigationProp<RootStackParamList>, authorId: number) {
    if (authSession?.user.id === authorId) {
      navigation.navigate('profile');
      return;
    }
    navigation.navigate('author', { authorId });
  }

  useEffect(() => {
    void hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    void hydrateNotifications(authSession);
  }, [authSession, hydrateNotifications]);

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

            <Stack.Screen name="notifications">
              {({ navigation }: AppScreenProps<'notifications'>) => (
                <NotificationScreen
                  onOpenAuth={() => navigation.navigate('auth')}
                  onOpenPost={(postId) => navigation.navigate('blog', { postId })}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="profile">
              {({ navigation }: AppScreenProps<'profile'>) => (
                <ProfileScreen
                  onOpenAuth={() => navigation.navigate('auth')}
                  onOpenPost={(postId) => navigation.navigate('blog', { postId })}
                  onOpenAuthor={(authorId) => openAuthorProfileAware(navigation, authorId)}
                  onOpenTag={(tag) => navigation.navigate('home', { tag })}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="auth">
              {({ navigation }: AppScreenProps<'auth'>) => (
                <AuthScreen
                  onBack={() => navigation.goBack()}
                  onDone={() => {
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
                  onOpenAuthor={(authorId) => openAuthorProfileAware(navigation, authorId)}
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
