import { parse } from "@babel/parser";
import generate from "@babel/generator";
import traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import fg from "fast-glob";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type LocaleJson = Record<string, string>;

const projectRoot = process.cwd();
const zhLocalePath = path.join(
  projectRoot,
  "src",
  "i18n",
  "locales",
  "zh-CN.json",
);
const enLocalePath = path.join(
  projectRoot,
  "src",
  "i18n",
  "locales",
  "en-US.json",
);
const sourcePatterns = ["src/**/*.{ts,tsx,js,jsx}", "App.tsx", "index.ts"];
const ignorePatterns = [
  "src/i18n/**",
  "**/*.d.ts",
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
];
const cjkPattern = /[\u4e00-\u9fff]/;

function readLocaleJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as LocaleJson;
}

function writeLocaleJson(filePath: string, locale: LocaleJson) {
  const sorted = Object.keys(locale)
    .sort((left, right) => left.localeCompare(right))
    .reduce<LocaleJson>((result, key) => {
      result[key] = locale[key];
      return result;
    }, {});
  writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

function shouldMigrateKey(key: string, zhValue?: string) {
  return Boolean(zhValue && cjkPattern.test(zhValue) && key !== zhValue);
}

function migrateLocaleKeys(zhLocale: LocaleJson, enLocale: LocaleJson) {
  const keyMap = new Map<string, string>();
  const nextZh: LocaleJson = {};
  const nextEn: LocaleJson = { ...enLocale };

  for (const [key, zhValue] of Object.entries(zhLocale)) {
    const nextKey = shouldMigrateKey(key, zhValue) ? zhValue : key;
    keyMap.set(key, nextKey);
    if (!nextZh[nextKey]) {
      nextZh[nextKey] = zhValue;
    }
    if (enLocale[key] && !nextEn[nextKey]) {
      nextEn[nextKey] = enLocale[key];
    }
  }

  for (const [oldKey, nextKey] of keyMap) {
    if (oldKey !== nextKey) {
      delete nextEn[oldKey];
    }
  }

  return { keyMap, nextZh, nextEn };
}

function isTranslationCall(pathRef: NodePath<t.StringLiteral>) {
  const parent = pathRef.parent;
  if (!t.isCallExpression(parent) || parent.arguments[0] !== pathRef.node) {
    return false;
  }
  const callee = parent.callee;
  if (t.isIdentifier(callee)) {
    return callee.name === "t";
  }
  if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
    return callee.property.name === "t";
  }
  return false;
}

function migrateFile(file: string, keyMap: Map<string, string>) {
  const absolutePath = path.join(projectRoot, file);
  const source = readFileSync(absolutePath, "utf8");
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    errorRecovery: true,
  });
  let replacements = 0;
  let touchedTranslationKey = false;

  traverse(ast, {
    StringLiteral(pathRef: NodePath<t.StringLiteral>) {
      if (!isTranslationCall(pathRef)) {
        return;
      }
      touchedTranslationKey = true;
      delete (pathRef.node as t.StringLiteral & { extra?: unknown }).extra;
      const nextKey = keyMap.get(pathRef.node.value);
      if (!nextKey || nextKey === pathRef.node.value) {
        return;
      }
      pathRef.node.value = nextKey;
      replacements += 1;
    },
  });

  if (!touchedTranslationKey) {
    return null;
  }

  const output = generate(
    ast,
    { jsescOption: { minimal: true }, retainLines: true },
    source,
  ).code;
  writeFileSync(absolutePath, `${output}\n`, "utf8");
  return { file, replacements };
}

async function main() {
  const zhLocale = readLocaleJson(zhLocalePath);
  const enLocale = readLocaleJson(enLocalePath);
  const { keyMap, nextZh, nextEn } = migrateLocaleKeys(zhLocale, enLocale);
  const files = await fg(sourcePatterns, {
    cwd: projectRoot,
    ignore: ignorePatterns,
    absolute: false,
  });
  const changes = files.flatMap((file) => {
    const change = migrateFile(file, keyMap);
    return change ? [change] : [];
  });

  writeLocaleJson(zhLocalePath, nextZh);
  writeLocaleJson(enLocalePath, nextEn);

  console.log(`Migrated locale keys. Updated ${changes.length} files.`);
  for (const change of changes) {
    console.log(`${change.file}: ${change.replacements} replacements`);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
