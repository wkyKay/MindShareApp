import type { CommentItem } from "../../services/commentsApi";

export function findRootId(
  comment: CommentItem,
  commentsById: Map<number, CommentItem>,
) {
  let current = comment;
  while (current.parent_id && commentsById.has(current.parent_id)) {
    const parent = commentsById.get(current.parent_id)!;
    if (!parent.parent_id) {
      return parent.id;
    }
    current = parent;
  }
  return current.parent_id || current.id;
}

export function collectDeletedIds(
  commentId: number,
  comments: CommentItem[],
) {
  const deletedIds = new Set<number>([commentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const comment of comments) {
      if (
        comment.parent_id &&
        deletedIds.has(comment.parent_id) &&
        !deletedIds.has(comment.id)
      ) {
        deletedIds.add(comment.id);
        changed = true;
      }
    }
  }
  return deletedIds;
}
