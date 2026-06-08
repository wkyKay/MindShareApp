import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Keyboard, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  createNavigationContainerRef,
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type NavigationProp,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";

import { BottomTabs, type Page } from "./src/components/BottomTabs";
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
import { useAuthStore } from "./src/stores/authStore";
import { useMessageStore } from "./src/stores/messageStore";
import { useNotificationStore } from "./src/stores/notificationStore";
import { ThemeProvider, useAppTheme } from "./src/theme/ThemeProvider";

type RootStackParamList = {
  home: { tag?: string } | undefined;
  aiChat: undefined;
  messages: undefined;
  upload: undefined;
  notifications: { category: "comments" | "likes" | "follows" };
  profile: undefined;
  profileAnalytics: undefined;
  profileSettings: undefined;
  auth: undefined;
  blog: { postId: number; focusCommentId?: number; startEditing?: boolean };
  author: { authorId: number };
  chat: { conversationId: number; partnerId: number; partnerName: string };
};

type AppScreenProps<RouteName extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, RouteName>;

const Stack = createNativeStackNavigator<RootStackParamList>();
const tabPages = new Set<string>([
  "home",
  "aiChat",
  "messages",
  "upload",
  "profile",
]);
const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
  const [activePage, setActivePage] =
    useState<keyof RootStackParamList>("home");
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
      navigation.navigate("profile");
      return;
    }
    navigation.navigate("author", { authorId });
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
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onStateChange={(state) => {
          const routeName = state?.routes[state.index]?.name;
          if (routeName) {
            setActivePage(routeName as Page);
          }
        }}
      >
        <View style={styles.shell}>
          <View
            style={[
              styles.app,
              keyboardInset > 0 && { paddingBottom: keyboardInset },
            ]}
          >
            <Stack.Navigator
              initialRouteName="home"
              screenOptions={{
                animation: "slide_from_right",
                contentStyle: { backgroundColor: colors.background },
                gestureEnabled: true,
                headerShown: false,
              }}
            >
              <Stack.Screen name="home">
                {({ navigation, route }: AppScreenProps<"home">) => (
                  <HomeScreen
                    session={authSession}
                    selectedRouteTag={route.params?.tag}
                    onOpenPost={(postId) =>
                      navigation.navigate("blog", { postId })
                    }
                    onOpenAuthor={(authorId) =>
                      openAuthorProfileAware(navigation, authorId)
                    }
                    onOpenTag={(tag) =>
                      navigation.navigate("home", { tag: tag || undefined })
                    }
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="aiChat">
                {() => <AiChatScreen />}
              </Stack.Screen>

              <Stack.Screen name="messages">
                {({ navigation }: AppScreenProps<"messages">) => (
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
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="upload">
                {({ navigation }: AppScreenProps<"upload">) => (
                  <UploadScreen
                    session={authSession}
                    onCancel={() => navigation.goBack()}
                    onSaved={() => {
                      navigation.navigate("profile");
                    }}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="notifications">
                {({ navigation, route }: AppScreenProps<"notifications">) => (
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
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="profile">
                {({ navigation }: AppScreenProps<"profile">) => (
                  <ProfileScreen
                    onOpenAuth={() => navigation.navigate("auth")}
                    onOpenPost={(postId) =>
                      navigation.navigate("blog", { postId })
                    }
                    onEditPost={(postId) =>
                      navigation.navigate("blog", {
                        postId,
                        startEditing: true,
                      })
                    }
                    onOpenAuthor={(authorId) =>
                      openAuthorProfileAware(navigation, authorId)
                    }
                    onOpenTag={(tag) => navigation.navigate("home", { tag })}
                    onOpenAnalytics={() =>
                      navigation.navigate("profileAnalytics")
                    }
                    onOpenSettings={() => navigation.navigate("profileSettings")}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="profileSettings">
                {({ navigation }: AppScreenProps<"profileSettings">) => (
                  <ProfileSettingsScreen
                    session={authSession}
                    onBack={() => navigation.goBack()}
                    onRequireAuth={() => navigation.navigate("auth")}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="profileAnalytics">
                {({ navigation }: AppScreenProps<"profileAnalytics">) => (
                  <ProfileAnalyticsScreen
                    onBack={() => navigation.goBack()}
                    onOpenAuth={() => navigation.navigate("auth")}
                    onOpenPost={(postId) =>
                      navigation.navigate("blog", { postId })
                    }
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="auth">
                {({ navigation }: AppScreenProps<"auth">) => (
                  <AuthScreen
                    onBack={() => navigation.goBack()}
                    onDone={() => {
                      navigation.navigate("profile");
                    }}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="blog">
                {({ navigation, route }: AppScreenProps<"blog">) => (
                  <BlogScreen
                    postId={route.params.postId}
                    focusCommentId={route.params.focusCommentId}
                    startEditing={route.params.startEditing}
                    session={authSession}
                    onBack={() => navigation.goBack()}
                    onDeleted={() => {
                      navigation.navigate("profile");
                    }}
                    onRequireAuth={() => navigation.navigate("auth")}
                    onOpenAuthor={(authorId) =>
                      openAuthorProfileAware(navigation, authorId)
                    }
                    onOpenTag={(tag) => navigation.navigate("home", { tag })}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="author">
                {({ navigation, route }: AppScreenProps<"author">) => (
                  <AuthorScreen
                    onBack={() => navigation.goBack()}
                    author_id={route.params.authorId}
                    session={authSession}
                    onRequireAuth={() => navigation.navigate("auth")}
                    onOpenPost={(postId) =>
                      navigation.navigate("blog", { postId })
                    }
                    onOpenTag={(tag) => navigation.navigate("home", { tag })}
                    onOpenMessage={(conversationId, partnerId, partnerName) =>
                      navigation.navigate("chat", {
                        conversationId,
                        partnerId,
                        partnerName,
                      })
                    }
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="chat">
                {({ navigation, route }: AppScreenProps<"chat">) => (
                  <ChatScreen
                    conversationId={route.params.conversationId}
                    partnerId={route.params.partnerId}
                    partnerName={route.params.partnerName}
                    onBack={() => navigation.goBack()}
                    onRequireAuth={() => navigation.navigate("auth")}
                  />
                )}
              </Stack.Screen>
            </Stack.Navigator>
            {tabPages.has(activePage) && (
              <BottomTabs
                activePage={activePage as Exclude<Page, "auth">}
                onChangePage={(page) => {
                  if (navigationRef.isReady()) {
                    navigationRef.navigate(page);
                  }
                }}
              />
            )}
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
