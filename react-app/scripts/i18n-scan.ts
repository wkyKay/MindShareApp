import { parse } from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import type {
  ExportNamedDeclaration,
  ImportDeclaration,
  JSXAttribute,
  JSXText,
  Node,
  ObjectProperty,
  StringLiteral,
  TemplateLiteral,
  TSEnumMember,
  TSImportType,
  TSLiteralType,
} from "@babel/types";
import fg from "fast-glob";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Finding = {
  file: string;
  line: number;
  kind: string;
  text: string;
  suggestedKey?: string;
};

type LocaleJson = Record<string, string>;

const projectRoot = process.cwd();
const workspaceRoot = path.resolve(projectRoot, "..");
const reportPath = path.join(
  workspaceRoot,
  "docs",
  "i18n-untranslated-report.md",
);
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
const cjkPattern = /[\u4e00-\u9fff]/;
const isSyncMode = process.argv.includes("--sync");

const sourcePatterns = ["src/**/*.{ts,tsx,js,jsx}", "App.tsx", "index.ts"];
const ignorePatterns = [
  "src/i18n/**",
  "src/components/samplePosts.ts",
  "**/*.d.ts",
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
];

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hasCjk(value: string) {
  return cjkPattern.test(value);
}

function locationOf(node: Node) {
  return node.loc?.start.line ?? 0;
}

function isInImportOrExport(pathRef: NodePath<Node>) {
  return Boolean(
    pathRef.findParent(
      (parent) =>
        parent.isImportDeclaration() || parent.isExportNamedDeclaration(),
    ),
  );
}

function isObjectKey(pathRef: NodePath<StringLiteral>) {
  const parent = pathRef.parent;
  return (
    parent.type === "ObjectProperty" &&
    (parent as ObjectProperty).key === pathRef.node
  );
}

function isTypeLiteral(pathRef: NodePath<StringLiteral>) {
  return Boolean(
    pathRef.findParent(
      (parent) => parent.isTSLiteralType() || parent.isTSEnumMember(),
    ),
  );
}

function isAlreadyTranslated(pathRef: NodePath<Node>) {
  return Boolean(
    pathRef.findParent((parent) => {
      if (!parent.isCallExpression()) {
        return false;
      }
      const callee = parent.node.callee;
      if (callee.type === "Identifier") {
        return callee.name === "t";
      }
      if (
        callee.type === "MemberExpression" &&
        callee.property.type === "Identifier"
      ) {
        return callee.property.name === "t";
      }
      return false;
    }),
  );
}

function isPathLike(value: string) {
  return /^(\.{1,2}\/|\/|https?:\/\/)/.test(value);
}

function suggestedKeyFor(finding: Finding) {
  return finding.text;
}

function normalizeGeneratedKey(key: string) {
  return key;
}

function readLocaleJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as LocaleJson;
}

function findKeyByValue(_locale: LocaleJson, value: string) {
  return value;
}

function sortLocale(locale: LocaleJson) {
  return Object.keys(locale)
    .sort((left, right) => left.localeCompare(right))
    .reduce<LocaleJson>((sorted, key) => {
      sorted[key] = locale[key];
      return sorted;
    }, {});
}

function writeLocaleJson(filePath: string, locale: LocaleJson) {
  writeFileSync(
    filePath,
    `${JSON.stringify(sortLocale(locale), null, 2)}\n`,
    "utf8",
  );
}

function migrateGeneratedKeys(locale: LocaleJson) {
  return locale;
}

function addFinding(
  findings: Finding[],
  file: string,
  node: Node,
  kind: string,
  rawText: string,
) {
  const text = normalizeText(rawText);
  if (!text || !hasCjk(text) || isPathLike(text)) {
    return;
  }
  findings.push({ file, line: locationOf(node), kind, text });
}

function scanFile(file: string) {
  const absolutePath = path.join(projectRoot, file);
  const source = readFileSync(absolutePath, "utf8");
  const findings: Finding[] = [];

  const ast = parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    errorRecovery: true,
  });

  traverse(ast, {
    JSXText(pathRef: NodePath<JSXText>) {
      if (isAlreadyTranslated(pathRef as NodePath<Node>)) {
        return;
      }
      addFinding(findings, file, pathRef.node, "JSXText", pathRef.node.value);
    },
    JSXAttribute(pathRef: NodePath<JSXAttribute>) {
      const value = pathRef.node.value;
      if (!value || value.type !== "StringLiteral") {
        return;
      }
      addFinding(
        findings,
        file,
        value,
        `JSXAttribute ${pathRef.node.name.name.toString()}`,
        value.value,
      );
    },
    StringLiteral(pathRef: NodePath<StringLiteral>) {
      if (
        isInImportOrExport(pathRef as NodePath<Node>) ||
        isObjectKey(pathRef) ||
        isTypeLiteral(pathRef) ||
        isAlreadyTranslated(pathRef as NodePath<Node>)
      ) {
        return;
      }
      addFinding(
        findings,
        file,
        pathRef.node,
        "StringLiteral",
        pathRef.node.value,
      );
    },
    TemplateLiteral(pathRef: NodePath<TemplateLiteral>) {
      if (isAlreadyTranslated(pathRef as NodePath<Node>)) {
        return;
      }
      const text = pathRef.node.quasis
        .map((quasi) => quasi.value.cooked ?? quasi.value.raw)
        .join("${...}");
      addFinding(findings, file, pathRef.node, "TemplateLiteral", text);
    },
    ImportDeclaration(pathRef: NodePath<ImportDeclaration>) {
      pathRef.skip();
    },
    ExportNamedDeclaration(pathRef: NodePath<ExportNamedDeclaration>) {
      if (pathRef.node.source) {
        pathRef.skip();
      }
    },
    TSImportType(pathRef: NodePath<TSImportType>) {
      pathRef.skip();
    },
    TSLiteralType(pathRef: NodePath<TSLiteralType>) {
      pathRef.skip();
    },
    TSEnumMember(pathRef: NodePath<TSEnumMember>) {
      pathRef.skip();
    },
  });

  return findings;
}

function groupByFile(findings: Finding[]) {
  return findings.reduce<Record<string, Finding[]>>((groups, finding) => {
    groups[finding.file] = groups[finding.file] ?? [];
    groups[finding.file].push(finding);
    return groups;
  }, {});
}

function renderMarkdownReport(findings: Finding[]) {
  const generatedAt = new Date().toISOString();
  const lines = [
    "# I18n Untranslated Report",
    "",
    `Generated at: ${generatedAt}`,
    "",
    `Total findings: ${findings.length}`,
    "",
  ];

  if (findings.length === 0) {
    lines.push("No untranslated CJK literals found.");
    return lines.join("\n");
  }

  const grouped = groupByFile(findings);
  for (const file of Object.keys(grouped).sort()) {
    lines.push(`## ${file}`, "");
    for (const finding of grouped[file]) {
      const keyHint = finding.suggestedKey ? ` -> ${finding.suggestedKey}` : "";
      lines.push(
        `- Line ${finding.line}: ${finding.kind}: \`${finding.text.replace(/`/g, "\\`")}\`${keyHint}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function attachSuggestedKeys(findings: Finding[]) {
  const zhLocale = readLocaleJson(zhLocalePath);
  migrateGeneratedKeys(zhLocale);
  return findings.map((finding) => ({
    ...finding,
    suggestedKey: normalizeGeneratedKey(
      findKeyByValue(zhLocale, finding.text) ?? suggestedKeyFor(finding),
    ),
  }));
}

function syncLocales(findings: Finding[]) {
  const zhLocale = readLocaleJson(zhLocalePath);
  const enLocale = readLocaleJson(enLocalePath);
  let zhAdded = 0;
  let enAdded = 0;

  migrateGeneratedKeys(zhLocale);
  migrateGeneratedKeys(enLocale);

  for (const finding of findings) {
    const key = normalizeGeneratedKey(
      finding.suggestedKey ?? suggestedKeyFor(finding),
    );
    if (!zhLocale[key]) {
      zhLocale[key] = finding.text;
      zhAdded += 1;
    }
    if (!enLocale[key]) {
      enLocale[key] = `TODO: ${finding.text}`;
      enAdded += 1;
    }
  }

  writeLocaleJson(zhLocalePath, zhLocale);
  writeLocaleJson(enLocalePath, enLocale);
  return { zhAdded, enAdded };
}

async function main() {
  const files = await fg(sourcePatterns, {
    cwd: projectRoot,
    ignore: ignorePatterns,
    absolute: false,
  });

  const findings = attachSuggestedKeys(files.flatMap(scanFile)).sort(
    (left, right) => {
      if (left.file === right.file) {
        return left.line - right.line;
      }
      return left.file.localeCompare(right.file);
    },
  );

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, renderMarkdownReport(findings), "utf8");

  if (isSyncMode) {
    const { zhAdded, enAdded } = syncLocales(findings);
    console.log(
      `Synced locale files. zh-CN added: ${zhAdded}, en-US added: ${enAdded}.`,
    );
  }

  if (findings.length === 0) {
    console.log("No untranslated CJK literals found.");
    console.log(`Report written to ${path.relative(projectRoot, reportPath)}`);
    return;
  }

  console.log(`Found ${findings.length} untranslated CJK literals.`);
  console.log(`Report written to ${path.relative(projectRoot, reportPath)}`);
  console.log("");

  for (const finding of findings.slice(0, 30)) {
    console.log(
      `${finding.file}:${finding.line} ${finding.kind}: "${finding.text}"`,
    );
  }
  if (findings.length > 30) {
    console.log(`... ${findings.length - 30} more findings in the report.`);
  }

  if (!isSyncMode) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
