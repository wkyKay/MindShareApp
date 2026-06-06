import { parse } from "@babel/parser";
import generate from "@babel/generator";
import traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import fg from "fast-glob";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type LocaleJson = Record<string, string>;

type FileChange = {
  file: string;
  replacements: number;
};

const projectRoot = process.cwd();
const isDryRun = process.argv.includes("--dry-run");
const cjkPattern = /[\u4e00-\u9fff]/;
const zhLocalePath = path.join(
  projectRoot,
  "src",
  "i18n",
  "locales",
  "zh-CN.json",
);

const sourcePatterns = ["src/components/**/*.tsx", "src/screens/**/*.tsx"];
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

function readLocaleJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as LocaleJson;
}

function buildTextToKeyMap(locale: LocaleJson) {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(locale)) {
    if (!hasCjk(value) || value.includes("${...}")) {
      continue;
    }
    const normalized = normalizeText(value);
    if (!map.has(normalized)) {
      map.set(normalized, value);
    }
  }
  return map;
}

function createTCall(key: string) {
  return t.callExpression(t.identifier("t"), [t.stringLiteral(key)]);
}

function findFunctionScope(pathRef: NodePath<t.Node>) {
  return pathRef.findParent(
    (parent) =>
      parent.isFunctionDeclaration() ||
      parent.isFunctionExpression() ||
      parent.isArrowFunctionExpression(),
  ) as NodePath<
    t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
  > | null;
}

function hasUseTranslationCall(
  functionNode:
    | t.FunctionDeclaration
    | t.FunctionExpression
    | t.ArrowFunctionExpression,
) {
  if (!t.isBlockStatement(functionNode.body)) {
    return false;
  }
  return functionNode.body.body.some((statement) => {
    if (!t.isVariableDeclaration(statement)) {
      return false;
    }
    return statement.declarations.some((declaration) => {
      if (!t.isCallExpression(declaration.init)) {
        return false;
      }
      return t.isIdentifier(declaration.init.callee, {
        name: "useTranslation",
      });
    });
  });
}

function insertUseTranslation(
  functionNode:
    | t.FunctionDeclaration
    | t.FunctionExpression
    | t.ArrowFunctionExpression,
) {
  if (
    !t.isBlockStatement(functionNode.body) ||
    hasUseTranslationCall(functionNode)
  ) {
    return false;
  }

  const declaration = t.variableDeclaration("const", [
    t.variableDeclarator(
      t.objectPattern([
        t.objectProperty(t.identifier("t"), t.identifier("t"), false, true),
      ]),
      t.callExpression(t.identifier("useTranslation"), []),
    ),
  ]);

  const body = functionNode.body.body;
  const insertIndex = body.findIndex(
    (statement) =>
      !t.isExpressionStatement(statement) ||
      !t.isStringLiteral(statement.expression),
  );
  body.splice(insertIndex === -1 ? 0 : insertIndex, 0, declaration);
  return true;
}

function hasUseTranslationImport(program: t.Program) {
  return program.body.some((statement) => {
    if (
      !t.isImportDeclaration(statement) ||
      statement.source.value !== "react-i18next"
    ) {
      return false;
    }
    return statement.specifiers.some(
      (specifier) =>
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported, { name: "useTranslation" }),
    );
  });
}

function ensureUseTranslationImport(program: t.Program) {
  for (const statement of program.body) {
    if (
      t.isImportDeclaration(statement) &&
      statement.source.value === "react-i18next"
    ) {
      if (
        !statement.specifiers.some(
          (specifier) =>
            t.isImportSpecifier(specifier) &&
            t.isIdentifier(specifier.imported, { name: "useTranslation" }),
        )
      ) {
        statement.specifiers.push(
          t.importSpecifier(
            t.identifier("useTranslation"),
            t.identifier("useTranslation"),
          ),
        );
      }
      return;
    }
  }

  const importDeclaration = t.importDeclaration(
    [
      t.importSpecifier(
        t.identifier("useTranslation"),
        t.identifier("useTranslation"),
      ),
    ],
    t.stringLiteral("react-i18next"),
  );
  const lastImportIndex = program.body.reduce(
    (lastIndex, statement, index) =>
      t.isImportDeclaration(statement) ? index : lastIndex,
    -1,
  );
  program.body.splice(lastImportIndex + 1, 0, importDeclaration);
}

function canUseHookInScope(
  scopePath: NodePath<
    t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
  >,
) {
  const parentFunction = scopePath.findParent(
    (parent) =>
      parent.isFunctionDeclaration() ||
      parent.isFunctionExpression() ||
      parent.isArrowFunctionExpression(),
  );
  if (parentFunction) {
    return false;
  }
  const node = scopePath.node;
  if (t.isFunctionDeclaration(node)) {
    return Boolean(node.id?.name && /^[A-Z]/.test(node.id.name));
  }
  const parent = scopePath.parent;
  if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
    return /^[A-Z]/.test(parent.id.name);
  }
  return false;
}

function isPureJsxText(pathRef: NodePath<t.JSXText>) {
  const parent = pathRef.parent;
  if (!t.isJSXElement(parent)) {
    return false;
  }
  return parent.children.every((child) => {
    if (t.isJSXText(child)) {
      return normalizeText(child.value) === "" || child === pathRef.node;
    }
    return false;
  });
}

function scanAndApply(file: string, textToKey: Map<string, string>) {
  const absolutePath = path.join(projectRoot, file);
  const source = readFileSync(absolutePath, "utf8");
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    errorRecovery: true,
  });

  let replacements = 0;
  const scopesNeedingTranslation = new Set<
    t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
  >();

  traverse(ast, {
    JSXText(pathRef: NodePath<t.JSXText>) {
      const text = normalizeText(pathRef.node.value);
      if (!text || !hasCjk(text) || !isPureJsxText(pathRef)) {
        return;
      }
      const key = textToKey.get(text);
      if (!key) {
        return;
      }
      const functionScope = findFunctionScope(pathRef as NodePath<t.Node>);
      if (!functionScope || !canUseHookInScope(functionScope)) {
        return;
      }

      pathRef.replaceWith(
        t.jsxExpressionContainer(createTCall(key)) as unknown as t.JSXText,
      );
      scopesNeedingTranslation.add(functionScope.node);
      replacements += 1;
    },
    JSXAttribute(pathRef: NodePath<t.JSXAttribute>) {
      const value = pathRef.node.value;
      if (!value || !t.isStringLiteral(value)) {
        return;
      }
      const text = normalizeText(value.value);
      if (!text || !hasCjk(text)) {
        return;
      }
      const key = textToKey.get(text);
      if (!key) {
        return;
      }
      const functionScope = findFunctionScope(pathRef as NodePath<t.Node>);
      if (!functionScope || !canUseHookInScope(functionScope)) {
        return;
      }

      pathRef.node.value = t.jsxExpressionContainer(createTCall(key));
      scopesNeedingTranslation.add(functionScope.node);
      replacements += 1;
    },
  });

  if (replacements === 0) {
    return null;
  }

  for (const functionNode of scopesNeedingTranslation) {
    insertUseTranslation(functionNode);
  }
  ensureUseTranslationImport(ast.program);

  if (!isDryRun) {
    const output = generate(
      ast,
      { jsescOption: { minimal: true }, retainLines: true },
      source,
    ).code;
    writeFileSync(absolutePath, `${output}\n`, "utf8");
  }

  return { file, replacements } satisfies FileChange;
}

async function main() {
  const locale = readLocaleJson(zhLocalePath);
  const textToKey = buildTextToKeyMap(locale);
  const files = await fg(sourcePatterns, {
    cwd: projectRoot,
    ignore: ignorePatterns,
    absolute: false,
  });

  const changes = files.flatMap((file) => {
    const change = scanAndApply(file, textToKey);
    return change ? [change] : [];
  });

  if (changes.length === 0) {
    console.log("No safe JSX i18n replacements found.");
    return;
  }

  console.log(
    `${isDryRun ? "Would update" : "Updated"} ${changes.length} files.`,
  );
  for (const change of changes) {
    console.log(`${change.file}: ${change.replacements} replacements`);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
