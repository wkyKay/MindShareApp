import { Pressable, View } from "react-native";
import type { DimensionValue } from "react-native";
import { useAppStyles } from "../theme/ThemeProvider";

type SkeletonBlockProps = {
  width?: DimensionValue;
  height?: number;
};

function SkeletonBlock({ width = "100%", height = 14 }: SkeletonBlockProps) {
  const styles = useAppStyles();
  return <View style={[styles.skeletonBlock, { width, height }]} />;
}

export function PostCardSkeleton() {
  const styles = useAppStyles();
  return (
    <View style={styles.card}>
      <SkeletonBlock width="72%" height={20} />
      <View style={styles.skeletonGapSmall} />
      <SkeletonBlock width="42%" height={13} />
      <View style={styles.skeletonGapMedium} />
      <SkeletonBlock width="100%" />
      <View style={styles.skeletonGapSmall} />
      <SkeletonBlock width="86%" />
      <View style={styles.skeletonGapMedium} />
      <View style={styles.cardStats}>
        <SkeletonBlock width={54} height={13} />
        <SkeletonBlock width={54} height={13} />
        <SkeletonBlock width={54} height={13} />
      </View>
    </View>
  );
}

export function HomePostListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </View>
  );
}

export function BlogDetailSkeleton({ onBack }: { onBack: () => void }) {
  const styles = useAppStyles();
  return (
    <View style={styles.pageContent}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <SkeletonBlock width={54} height={16} />
      </Pressable>
      <SkeletonBlock width="82%" height={30} />
      <View style={styles.skeletonGapMedium} />
      <SkeletonBlock width="36%" height={15} />
      <View style={styles.skeletonGapSmall} />
      <SkeletonBlock width="48%" height={13} />
      <View style={styles.skeletonTagRow}>
        <SkeletonBlock width={58} height={28} />
        <SkeletonBlock width={74} height={28} />
        <SkeletonBlock width={62} height={28} />
      </View>
      <View style={styles.skeletonHero} />
      <SkeletonBlock width="100%" />
      <View style={styles.skeletonGapSmall} />
      <SkeletonBlock width="96%" />
      <View style={styles.skeletonGapSmall} />
      <SkeletonBlock width="88%" />
      <View style={styles.skeletonGapSmall} />
      <SkeletonBlock width="72%" />
      <View style={styles.skeletonGapLarge} />
      <SkeletonBlock width="42%" height={22} />
    </View>
  );
}

export function ProfileScreenSkeleton() {
  const styles = useAppStyles();
  return (
    <View style={styles.pageContent}>
      <View style={styles.profileHeader}>
        <SkeletonBlock width={60} height={60} />
        <View style={styles.profileHeaderText}>
          <SkeletonBlock width="58%" height={28} />
          <View style={styles.skeletonGapSmall} />
          <SkeletonBlock width="82%" height={14} />
        </View>
        <SkeletonBlock width={42} height={42} />
      </View>
      <View style={styles.skeletonGapLarge} />
      <SkeletonBlock width={70} height={16} />
      <View style={styles.profileStats}>
        <View style={styles.profileStatItem}>
          <SkeletonBlock width={36} height={22} />
          <View style={styles.skeletonGapSmall} />
          <SkeletonBlock width={42} height={13} />
        </View>
        <View style={styles.profileStatItem}>
          <SkeletonBlock width={36} height={22} />
          <View style={styles.skeletonGapSmall} />
          <SkeletonBlock width={42} height={13} />
        </View>
        <View style={styles.profileStatItem}>
          <SkeletonBlock width={36} height={22} />
          <View style={styles.skeletonGapSmall} />
          <SkeletonBlock width={42} height={13} />
        </View>
        <View style={styles.profileStatItem}>
          <SkeletonBlock width={36} height={22} />
          <View style={styles.skeletonGapSmall} />
          <SkeletonBlock width={42} height={13} />
        </View>
      </View>
      <SkeletonBlock width={96} height={22} />
      <View style={styles.skeletonGapMedium} />
      <PostCardSkeleton />
      <PostCardSkeleton />
      <PostCardSkeleton />
    </View>
  );
}
