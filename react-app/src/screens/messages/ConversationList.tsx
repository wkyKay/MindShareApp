import { Text } from "react-native";

import type { AppStyles } from "../../components/styles";
import type { ConversationItem } from "../../services/messagesApi";
import { SwipeConversationRow } from "./SwipeConversationRow";

type ConversationListProps = {
  conversations: ConversationItem[];
  latestMessageByConversation: Record<number, { body: string } | undefined>;
  unreadByConversation: Record<number, number | undefined>;
  onOpenChat: (
    conversationId: number,
    partnerId: number,
    partnerName: string,
  ) => void;
  onDeleteConversation: (conversationId: number) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function ConversationList({
  conversations,
  latestMessageByConversation,
  unreadByConversation,
  onOpenChat,
  onDeleteConversation,
  styles,
  t,
}: ConversationListProps) {
  return (
    <>
      <Text style={styles.sectionTitle}>{t("会话")}</Text>
      {conversations.length > 0 ? (
        conversations.map((item) => (
          <SwipeConversationRow
            key={item.id}
            item={item}
            latestBody={
              latestMessageByConversation[item.id]?.body ||
              item.last_message?.body ||
              t("暂无消息")
            }
            unreadCount={unreadByConversation[item.id] || item.unread_count}
            onOpen={() =>
              onOpenChat(item.id, item.partner.id, item.partner.display_name)
            }
            onDelete={() => onDeleteConversation(item.id)}
            styles={styles}
            t={t}
          />
        ))
      ) : (
        <Text style={styles.profileBio}>
          {t("暂无会话，先从上方关注列表或搜索里发起私信。")}
        </Text>
      )}
    </>
  );
}
