import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import type { AppStyles } from "../../components/styles";
import type { ConversationItem } from "../../services/messagesApi";
import { formatDateTimeMinute } from "../../utils/time";
import { MessageAvatar } from "./MessageAvatar";

type SwipeConversationRowProps = {
  item: ConversationItem;
  latestBody: string;
  unreadCount: number;
  onOpen: () => void;
  onDelete: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function SwipeConversationRow({
  item,
  latestBody,
  unreadCount,
  onOpen,
  onDelete,
  styles,
  t,
}: SwipeConversationRowProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const isSwipingRef = useRef(false);
  const swipeReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (swipeReleaseTimerRef.current) {
        clearTimeout(swipeReleaseTimerRef.current);
      }
    };
  }, []);

  function markSwiping() {
    if (swipeReleaseTimerRef.current) {
      clearTimeout(swipeReleaseTimerRef.current);
    }
    isSwipingRef.current = true;
  }

  function releaseSwipePressBlock() {
    if (swipeReleaseTimerRef.current) {
      clearTimeout(swipeReleaseTimerRef.current);
    }
    swipeReleaseTimerRef.current = setTimeout(() => {
      isSwipingRef.current = false;
    }, 220);
  }

  function handleOpen() {
    if (isSwipingRef.current) {
      return;
    }
    onOpen();
  }

  function renderRightActions() {
    return (
      <Pressable style={styles.swipeDeleteButton} onPress={onDelete}>
        <Text style={styles.swipeDeleteText}>{t("删除")}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.swipeConversationContainer}>
      <Swipeable
        ref={swipeableRef}
        friction={1.6}
        rightThreshold={36}
        overshootRight={false}
        onSwipeableOpenStartDrag={markSwiping}
        onSwipeableCloseStartDrag={markSwiping}
        onSwipeableWillOpen={releaseSwipePressBlock}
        onSwipeableWillClose={releaseSwipePressBlock}
        renderRightActions={renderRightActions}
      >
        <Pressable style={styles.messageConversationCard} onPress={handleOpen}>
          <MessageAvatar
            name={item.partner.display_name}
            avatarUrl={item.partner.avatar_url}
            styles={styles}
          />

          <View style={styles.messageRowTextBlock}>
            <Text style={styles.cardTitle}>{item.partner.display_name}</Text>
            <Text style={styles.messageLastText}>{latestBody}</Text>
          </View>
          <View style={styles.messageConversationSideMeta}>
            <Text style={styles.messageTimeText}>
              {formatDateTimeMinute(item.updated_at)}
            </Text>
            {unreadCount > 0 ? (
              <View style={styles.messageUnreadBadge}>
                <Text style={styles.messageUnreadText}>{unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Swipeable>
    </View>
  );
}
