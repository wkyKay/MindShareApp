import { Ionicons } from "@expo/vector-icons";
import { ScrollView, Text, View } from "react-native";

import { styles } from "../components/styles";
import { useTranslation } from "react-i18next";

export function AiChatScreen() {
  const { t } = useTranslation();
  return (
    <ScrollView
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>{t("AI 聊天")}</Text>
      <Text style={styles.messageCenterSubtitle}>
        {t("智能助手功能暂未实现，后续可用于内容建议、写作辅助和智能问答。")}
      </Text>

      <View style={styles.aiChatPanel}>
        <View style={styles.aiChatIconBubble}>
          <Ionicons name="sparkles-outline" size={26} color="#d94f70" />
        </View>
        <View style={styles.aiChatTextBlock}>
          <Text style={styles.aiChatTitle}>{t("AI 助手即将上线")}</Text>
          <Text style={styles.aiChatDescription}>
            {t("这里会取代原来的私信 tab，成为主页面里的 AI 聊天入口。")}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
