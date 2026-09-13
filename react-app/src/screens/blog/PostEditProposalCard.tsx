import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, type ViewStyle } from "react-native";

import { useTranslation } from "react-i18next";
import type { PostEditProposal } from "../../services/aiChatApi";
import type { PostDetail } from "../../services/postApi";
import { useAppTheme } from "../../theme/ThemeProvider";
import { compactDiff, diffLines, type DiffLine } from "../../utils/diff";

export type PostEditProposalState = PostEditProposal & {
  status: "pending" | "saving" | "saved" | "cancelled";
};

type PostEditProposalCardProps = {
  proposal: PostEditProposalState;
  post: PostDetail;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PostEditProposalCard({
  proposal,
  post,
  onConfirm,
  onCancel,
}: PostEditProposalCardProps) {
  const { colors, styles } = useAppTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { title, summary, body, description, status } = proposal;

  const bodyDiff = useMemo(() => {
    const raw = diffLines(post.body, body);
    return compactDiff(raw, 2);
  }, [post.body, body]);

  const titleChanged = title !== post.title;
  const summaryChanged = (summary || "") !== (post.summary || "");

  return (
    <View
      style={[
        styles.messageBubble,
        styles.messageBubbleOther as ViewStyle,
        {
          marginTop: 0,
          borderTopLeftRadius: 6,
          padding: 12,
          width: "88%",
          maxWidth: "88%",
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Ionicons name="create-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
          {t("博客修改方案")}
        </Text>
      </View>

      <Text
        style={{
          color: colors.textMuted,
          fontSize: 13,
          lineHeight: 19,
          marginBottom: 12,
        }}
      >
        {description}
      </Text>

      {titleChanged ? (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ color: colors.textSubtle, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>
            {t("标题")}
          </Text>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
            {title}
          </Text>
        </View>
      ) : null}

      {summaryChanged ? (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ color: colors.textSubtle, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>
            {t("摘要")}
          </Text>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>
            {summary || ""}
          </Text>
        </View>
      ) : null}

      <View style={{ marginBottom: 12 }}>
        <Pressable
          style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}
          onPress={() => setExpanded((v) => !v)}
        >
          <Text style={{ color: colors.textSubtle, fontSize: 12, fontWeight: "700" }}>
            {t("正文变更")}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.textSubtle}
          />
        </Pressable>
        {expanded ? (
          <ScrollView
            horizontal
            style={{
              backgroundColor: colors.surfaceSoft,
              borderRadius: 10,
              maxHeight: 260,
            }}
            contentContainerStyle={{ padding: 10, minWidth: "100%" }}
          >
            <View>
              {bodyDiff.map((line: DiffLine | { type: "omitted" }, idx: number) => {
                if ("type" in line && line.type === "omitted") {
                  return (
                    <Text
                      key={idx}
                      style={{ color: colors.textSubtle, fontSize: 12, fontStyle: "italic" }}
                    >
                      ...
                    </Text>
                  );
                }
                const dLine = line as { type: string; text: string };
                const prefix =
                  dLine.type === "added" ? "+ " : dLine.type === "removed" ? "- " : "  ";
                const textColor =
                  dLine.type === "added"
                    ? "#2e7d32"
                    : dLine.type === "removed"
                      ? "#c62828"
                      : colors.textMuted;
                return (
                  <Text
                    key={idx}
                    style={{
                      color: textColor,
                      fontSize: 12,
                      lineHeight: 18,
                      fontFamily: "Menlo",
                    }}
                  >
                    {prefix}
                    {dLine.text || " "}
                  </Text>
                );
              })}
            </View>
          </ScrollView>
        ) : null}
      </View>

      {status === "pending" && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            style={{
              flex: 1,
              backgroundColor: colors.surfaceSoft,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={onCancel}
          >
            <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: "600" }}>
              {t("取消")}
            </Text>
          </Pressable>
          <Pressable
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: "center",
            }}
            onPress={onConfirm}
          >
            <Text
              style={{
                color: colors.surface,
                fontSize: 14,
                fontWeight: "700",
              }}
            >
              {t("确认保存")}
            </Text>
          </Pressable>
        </View>
      )}

      {status === "saving" && (
        <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
          {t("保存中...")}
        </Text>
      )}

      {status === "saved" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
            {t("已保存")}
          </Text>
        </View>
      )}

      {status === "cancelled" && (
        <Text
          style={{
            color: colors.textSubtle,
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {t("已取消")}
        </Text>
      )}
    </View>
  );
}
