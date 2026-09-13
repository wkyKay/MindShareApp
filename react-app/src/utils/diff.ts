// 简易逐行 diff：输出带 +/- 前缀的行级变更
export type DiffLine = {
  type: "unchanged" | "added" | "removed";
  text: string;
};

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // 简化实现：LCS 基础上的 diff
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: "unchanged", text: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "removed", text: oldLines[i] });
      i++;
    } else {
      result.push({ type: "added", text: newLines[j] });
      j++;
    }
  }
  while (i < m) {
    result.push({ type: "removed", text: oldLines[i] });
    i++;
  }
  while (j < n) {
    result.push({ type: "added", text: newLines[j] });
    j++;
  }

  return result;
}

// 长文本时做折叠：仅保留变更附近上下文
export function compactDiff(
  lines: DiffLine[],
  contextLines = 2,
): (DiffLine | { type: "omitted" })[] {
  const result: (DiffLine | { type: "omitted" })[] = [];
  const changedIndexes = new Set<number>();
  lines.forEach((line, index) => {
    if (line.type !== "unchanged") {
      for (
        let k = Math.max(0, index - contextLines);
        k <= Math.min(lines.length - 1, index + contextLines);
        k++
      ) {
        changedIndexes.add(k);
      }
    }
  });

  let lastIncluded = -1;
  for (let i = 0; i < lines.length; i++) {
    if (changedIndexes.has(i)) {
      if (lastIncluded >= 0 && i > lastIncluded + 1) {
        result.push({ type: "omitted" });
      }
      result.push(lines[i]);
      lastIncluded = i;
    }
  }
  return result;
}
