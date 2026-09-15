import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export interface GateResult {
  pass: boolean;
  findings: string[];
}

export function filesUnder(dir: string, suffix: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full, suffix);
    return full.endsWith(suffix) ? [full] : [];
  });
}

export function rel(file: string): string {
  return path.relative(ROOT, file);
}

export function parseSource(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

export function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some(modifier => modifier.kind === kind) ?? false);
}

export function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (ts.isSatisfiesExpression(expression) || ts.isAsExpression(expression)) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

export function typedRecordCatalog(
  initializer: ts.Expression,
): ts.ObjectLiteralExpression | null {
  if (!ts.isSatisfiesExpression(initializer) ||
      !ts.isTypeReferenceNode(initializer.type) ||
      !ts.isIdentifier(initializer.type.typeName) ||
      initializer.type.typeName.text !== 'Record') return null;

  const [keyType, valueType] = initializer.type.typeArguments ?? [];
  if (keyType?.kind !== ts.SyntaxKind.StringKeyword ||
      valueType === undefined ||
      (!ts.isTypeReferenceNode(valueType) && !ts.isTypeLiteralNode(valueType))) return null;

  const object = unwrapExpression(initializer);
  if (!ts.isObjectLiteralExpression(object) || object.properties.length === 0) return null;
  const entries = object.properties.filter(ts.isPropertyAssignment);
  if (entries.length !== object.properties.length) return null;
  return entries.every(entry => ts.isObjectLiteralExpression(unwrapExpression(entry.initializer)))
    ? object
    : null;
}

const DATA_DIR = path.join(ROOT, 'src/data');

/** Catalog.key and Catalog.key.field paths declared by typed fixtures. */
export function collectFixtureHandles(): Set<string> {
  const handles = new Set<string>();
  for (const file of filesUnder(DATA_DIR, '.ts')) {
    const source = parseSource(file);
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement) ||
          !hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const catalog = typedRecordCatalog(declaration.initializer);
        if (!catalog) continue;
        const catalogName = declaration.name.text;
        handles.add(catalogName);
        for (const entry of catalog.properties) {
          if (!ts.isPropertyAssignment(entry)) continue;
          const key = entry.name.getText(source);
          handles.add(`${catalogName}.${key}`);
          const record = unwrapExpression(entry.initializer);
          if (!ts.isObjectLiteralExpression(record)) continue;
          for (const field of record.properties) {
            if (!ts.isPropertyAssignment(field)) continue;
            handles.add(`${catalogName}.${key}.${field.name.getText(source)}`);
          }
        }
      }
    }
  }
  return handles;
}
