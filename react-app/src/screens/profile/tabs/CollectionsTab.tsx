import { CollectionCard } from "../../../components/CollectionCard";
import type { ProfileCollection } from "../../../services/profileApi";

type CollectionsTabProps = {
  collection: ProfileCollection;
  onOpen: (collection: ProfileCollection) => void;
  onEdit: (collection: ProfileCollection) => void;
  onDelete: (collection: ProfileCollection) => void;
};

export function CollectionsTabItem({
  collection,
  onOpen,
  onEdit,
  onDelete,
}: CollectionsTabProps) {
  return (
    <CollectionCard
      collection={collection}
      onPress={() => onOpen(collection)}
      actions={[
        { label: "编辑", onPress: () => onEdit(collection) },
        { label: "删除", onPress: () => onDelete(collection), danger: true },
      ]}
    />
  );
}
