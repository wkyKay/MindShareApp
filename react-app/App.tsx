import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Keyboard, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type NavigationProp,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
  type BottomTabScreenProps,
} from "@react-navigation/bottom-tabs";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";

import { BottomTabs, type Page } from "./src/components/BottomTabs";
import { PageErrorBoundary } from "./src/components/PageErrorBoundary";
import { AuthScreen } from "./src/screens/AuthScreen";
import { AiChatScreen } from "./src/screens/AiChatScreen";
import { BlogScreen } from "./src/screens/BlogScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { MessagesScreen } from "./src/screens/MessagesScreen";
import { ChatScreen } from "./src/screens/ChatScreen";
import { NotificationScreen } from "./src/screens/NotificationScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ProfileAnalyticsScreen } from "./src/screens/ProfileAnalyticsScreen";
import { ProfileSettingsScreen } from "./src/screens/ProfileSettingsScreen";
import { UploadScreen } from "./src/screens/UploadScreen";
import { AuthorScreen } from "./src/screens/AuthorScreen";
import type { AuthSession } from "./src/services/authSession";
import { useAuthStore } from "./src/stores/authStore";
import { useMessageStore } from "./src/stores/messageStore";
import { useNotificationStore } from "./src/stores/notificationStore";
import { ThemeProvider, useAppTheme } from "./src/theme/ThemeProvider";

type TabPage = Exclude<Page, "auth">;

type MainTabParamList = {
  home: { tag?: string } | undefined;
  aiChat: undefined;
  messages: undefined;
  upload: undefined;
  profile: undefined;
};

type RootStackParamList = {
  mainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  notifications: { category: "comments" | "likes" | "follows" };
  profileAnalytics: undefined;
  profileSettings: undefined;
  auth: undefined;
  blog: { postId: number; focusCommentId?: number; startEditing?: boolean };
  author: { authorId: number };
  chat: { conversationId: number; partnerId: number; partnerName: string };
};

type AppScreenProps<RouteName extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, RouteName>;

type MainTabScreenProps<RouteName extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, RouteName>;

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const { colors, resolvedMode, styles } = useAppTheme();
  const navigationTheme = useMemo(
    () => ({
      ...(resolvedMode === "dark" ? DarkTheme : DefaultTheme),
      colors: {
        ...(resolvedMode === "dark" ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.background,
        card: colors.background,
        border: colors.border,
        notification: colors.primary,
        primary: colors.primary,
        text: colors.text,
      },
    }),
    [colors, resolvedMode],
  );
  const [keyboardInset, setKeyboardInset] = useState(0);
  const authSession = useAuthStore((state) => state.session);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrateMessages = useMessageStore((state) => state.hydrate);
  const hydrateNotifications = useNotificationStore((state) => state.hydrate);

  function openAuthorProfileAware(
    navigation: NavigationProp<RootStackParamList>,
    authorId: number,
  ) {
    if (authSession?.user.id === authorId) {
      navigation.navigate("mainTabs", { screen: "profile" });
      return;
    }
    navigation.navigate("author", { authorId });
  }

  function withPageBoundary(children: React.ReactNode, resetKey: string) {
    return (
      <PageErrorBoundary
        fallbackTitle="页面加载失败"
        retryLabel="重试"
        resetKey={resetKey}
      >
        {children}
      </PageErrorBoundary>
    );
  }

  useEffect(() => {
    void hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    void hydrateMessages(authSession);
    void hydrateNotifications(authSession);
  }, [authSession, hydrateMessages, hydrateNotifications]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <NavigationContainer theme={navigationTheme}>
        <View style={styles.shell}>
          <View
            style={[
              styles.app,
              keyboardInset > 0 && { paddingBottom: keyboardInset },
            ]}
          >
            <Stack.Navigator
              initialRouteName="mainTabs"
              screenOptions={{
                animation: "slide_from_right",
                contentStyle: { backgroundColor: colors.background },
                gestureEnabled: true,
                headerShown: false,
              }}
            >
              <Stack.Screen name="mainTabs">
                {(props: AppScreenProps<"mainTabs">) => (
                  <MainTabsScreen
                    {...props}
                    authSession={authSession}
                    openAuthorProfileAware={openAuthorProfileAware}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="notifications">
                {({ navigation, route }: AppScreenProps<"notifications">) => (
                  withPageBoundary(
                    <NotificationScreen
                      onOpenAuth={() => navigation.navigate("auth")}
                      onBack={() => navigation.goBack()}
                      category={route.params.category}
                      onOpenPost={(postId, focusCommentId) =>
                        navigation.navigate("blog", { postId, focusCommentId })
                      }
                      onOpenAuthor={(authorId) =>
                        openAuthorProfileAware(navigation, authorId)
                      }
                    />,
                    `notifications-${route.params.category}`,
                  )
                )}
              </Stack.Screen>

              <Stack.Screen name="profileSettings">
                {({ navigation }: AppScreenProps<"profileSettings">) => (
                  withPageBoundary(
                    <ProfileSettingsScreen
                      session={authSession}
                      onBack={() => navigation.goBack()}
                      onRequireAuth={() => navigation.navigate("auth")}
                    />,
                    "profileSettings",
                  )
                )}
              </Stack.Screen>

              <Stack.Screen name="profileAnalytics">
                {({ navigation }: AppScreenProps<"profileAnalytics">) => (
                  withPageBoundary(
                    <ProfileAnalyticsScreen
                      onBack={() => navigation.goBack()}
                      onOpenAuth={() => navigation.navigate("auth")}
                      onOpenPost={(postId) =>
                        navigation.navigate("blog", { postId })
                      }
                    />,
                    "profileAnalytics",
                  )
                )}
              </Stack.Screen>

              <Stack.Screen name="auth">
                {({ navigation }: AppScreenProps<"auth">) => (
                  withPageBoundary(
                    <AuthScreen
                      onBack={() => navigation.goBack()}
                      onDone={() => {
                        navigation.navigate("mainTabs", { screen: "profile" });
                      }}
                    />,
                    "auth",
                  )
                )}
              </Stack.Screen>

              <Stack.Screen name="blog">
                {({ navigation, route }: AppScreenProps<"blog">) => (
                  withPageBoundary(
                    <BlogScreen
                      postId={route.params.postId}
                      focusCommentId={route.params.focusCommentId}
                      startEditing={route.params.startEditing}
                      session={authSession}
                      onBack={() => navigation.goBack()}
                      onDeleted={() => {
                        navigation.navigate("mainTabs", { screen: "profile" });
                      }}
                      onRequireAuth={() => navigation.navigate("auth")}
                      onOpenAuthor={(authorId) =>
                        openAuthorProfileAware(navigation, authorId)
                      }
                      onOpenTag={(tag) =>
                        navigation.navigate("mainTabs", {
                          screen: "home",
                          params: { tag },
                        })
                      }
                    />,
                    `blog-${route.params.postId}`,
                  )
                )}
              </Stack.Screen>

              <Stack.Screen name="author">
                {({ navigation, route }: AppScreenProps<"author">) => (
                  withPageBoundary(
                    <AuthorScreen
                      onBack={() => navigation.goBack()}
                      author_id={route.params.authorId}
                      session={authSession}
                      onRequireAuth={() => navigation.navigate("auth")}
                      onOpenPost={(postId) =>
                        navigation.navigate("blog", { postId })
                      }
                      onOpenTag={(tag) =>
                        navigation.navigate("mainTabs", {
                          screen: "home",
                          params: { tag },
                        })
                      }
                      onOpenMessage={(conversationId, partnerId, partnerName) =>
                        navigation.navigate("chat", {
                          conversationId,
                          partnerId,
                          partnerName,
                        })
                      }
                    />,
                    `author-${route.params.authorId}`,
                  )
                )}
              </Stack.Screen>

              <Stack.Screen name="chat">
                {({ navigation, route }: AppScreenProps<"chat">) => (
                  withPageBoundary(
                    <ChatScreen
                      conversationId={route.params.conversationId}
                      partnerId={route.params.partnerId}
                      partnerName={route.params.partnerName}
                      onBack={() => navigation.goBack()}
                      onRequireAuth={() => navigation.navigate("auth")}
                    />,
                    `chat-${route.params.conversationId}`,
                  )
                )}
              </Stack.Screen>
            </Stack.Navigator>
          </View>
          <StatusBar
            style={resolvedMode === "dark" ? "light" : "dark"}
            backgroundColor={colors.background}
          />
        </View>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

type MainTabsScreenProps = AppScreenProps<"mainTabs"> & {
  authSession: AuthSession | null;
  openAuthorProfileAware: (
    navigation: NavigationProp<RootStackParamList>,
    authorId: number,
  ) => void;
};

function MainTabsScreen({
  authSession,
  navigation,
  openAuthorProfileAware,
}: MainTabsScreenProps) {
  function withPageBoundary(children: React.ReactNode, resetKey: string) {
    return (
      <PageErrorBoundary
        fallbackTitle="页面加载失败"
        retryLabel="重试"
        resetKey={resetKey}
      >
        {children}
      </PageErrorBoundary>
    );
  }

  return (
    <Tab.Navigator
      initialRouteName="home"
      screenOptions={{ headerShown: false, lazy: true }}
      tabBar={(props) => <MainTabBar {...props} />}
    >
      <Tab.Screen name="home">
        {({ navigation: tabNavigation, route }: MainTabScreenProps<"home">) => (
          withPageBoundary(
            <HomeScreen
              session={authSession}
              selectedRouteTag={route.params?.tag}
              onOpenPost={(postId) => navigation.navigate("blog", { postId })}
              onOpenAuthor={(authorId) =>
                openAuthorProfileAware(navigation, authorId)
              }
              onOpenTag={(tag) =>
                tabNavigation.navigate("home", { tag: tag || undefined })
              }
            />,
            `home-${route.params?.tag || "all"}`,
          )
        )}
      </Tab.Screen>

      <Tab.Screen name="aiChat">
        {() => withPageBoundary(<AiChatScreen />, "aiChat")}
      </Tab.Screen>

      <Tab.Screen name="upload">
        {({ navigation: tabNavigation }: MainTabScreenProps<"upload">) => (
          withPageBoundary(
            <UploadScreen
              session={authSession}
              onCancel={() => tabNavigation.navigate("home")}
              onSaved={() => tabNavigation.navigate("profile")}
            />,
            "upload",
          )
        )}
      </Tab.Screen>

      <Tab.Screen name="messages">
        {() => (
          withPageBoundary(
            <MessagesScreen
              onOpenAuth={() => navigation.navigate("auth")}
              onOpenChat={(conversationId, partnerId, partnerName) =>
                navigation.navigate("chat", {
                  conversationId,
                  partnerId,
                  partnerName,
                })
              }
              onOpenNotificationCategory={(category) =>
                navigation.navigate("notifications", { category })
              }
            />,
            "messages",
          )
        )}
      </Tab.Screen>

      <Tab.Screen name="profile">
        {({ navigation: tabNavigation }: MainTabScreenProps<"profile">) => (
          withPageBoundary(
            <ProfileScreen
              onOpenAuth={() => navigation.navigate("auth")}
              onOpenPost={(postId) => navigation.navigate("blog", { postId })}
              onEditPost={(postId) =>
                navigation.navigate("blog", {
                  postId,
                  startEditing: true,
                })
              }
              onOpenAuthor={(authorId) =>
                openAuthorProfileAware(navigation, authorId)
              }
              onOpenTag={(tag) =>
                tabNavigation.navigate("home", { tag: tag || undefined })
              }
              onOpenAnalytics={() => navigation.navigate("profileAnalytics")}
              onOpenSettings={() => navigation.navigate("profileSettings")}
            />,
            "profile",
          )
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function MainTabBar({ navigation, state }: BottomTabBarProps) {
  const activePage = state.routes[state.index]?.name as TabPage;

  return (
    <BottomTabs
      activePage={activePage}
      onChangePage={(page) => navigation.navigate(page)}
    />
  );
}
