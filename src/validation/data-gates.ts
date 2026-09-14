/**
 * Domain-neutral fixture architecture gates.
 *
 * This file validates where test data lives and how it is typed/exported.
 * It deliberately does not evaluate business policy, ownership, tiers,
 * lifecycle states, or cardinality. Those belong to wiki-grounded tests and
 * semantic review. `golden_dataset/data/` locks each structural rule.
 */
import path from 'node:path';
import ts from 'typescript';
import {
  filesUnder,
  hasModifier,
  parseSource,
  rel,
  ROOT,
  typedRecordCatalog,
  unwrapExpression,
} from './shared.js';

const DATA_DIR = path.join(ROOT, 'src/data');
const SRC_DIR = path.join(ROOT, 'src');
const FIXTURES_PATH = path.join(ROOT, 'src/fixtures/index.ts');
const CLEAN_GOLDEN_DIR = path.join(ROOT, 'golden_dataset/data/clean');
const DIRTY_GOLDEN_DIR = path.join(ROOT, 'golden_dataset/data/dirty');

function sourceLabel(source: ts.SourceFile): string {
  return path.isAbsolute(source.fileName) ? rel(source.fileName) : source.fileName;
}

function catalogObject(initializer: ts.Expression): ts.ObjectLiteralExpression | null {
  const object = unwrapExpression(initializer);
  if (!ts.isObjectLiteralExpression(object) || object.properties.length === 0) return null;
  const entries = object.properties.filter(ts.isPropertyAssignment);
  if (entries.length !== object.properties.length) return null;
  return entries.every(entry => ts.isObjectLiteralExpression(unwrapExpression(entry.initializer)))
    ? object
    : null;
}

function satisfiesRecord(initializer: ts.Expression): boolean {
  return typedRecordCatalog(initializer) !== null;
}

function validateReadonlySchemas(source: ts.SourceFile, findings: string[]): void {
  for (const statement of source.statements) {
    if (!ts.isInterfaceDeclaration(statement) ||
        !hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    for (const member of statement.members) {
      if (!ts.isPropertySignature(member)) continue;
      if (!member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)) {
        findings.push(
          `${sourceLabel(source)}: exported schema "${statement.name.text}" field ` +
          `"${member.name.getText(source)}" must be readonly`,
        );
      }
    }
  }
}

function validateCatalog(
  name: string,
  initializer: ts.Expression,
  source: ts.SourceFile,
  findings: string[],
): void {
  const catalog = catalogObject(initializer);
  if (!catalog) return;
  if (!satisfiesRecord(initializer)) {
    findings.push(
      `${sourceLabel(source)}: fixture catalog "${name}" must use ` +
      '`as const satisfies Record<string, Schema>`',
    );
  }
}

function fixtureExports(): Set<string> {
  const fixtureSource = parseSource(FIXTURES_PATH);
  const exports = new Set<string>();
  for (const statement of fixtureSource.statements) {
    if (!ts.isExportDeclaration(statement) ||
        !statement.exportClause ||
        !ts.isNamedExports(statement.exportClause)) continue;
    for (const element of statement.exportClause.elements) {
      exports.add(element.name.text);
    }
  }
  return exports;
}

function validateDataSource(
  source: ts.SourceFile,
  exportedThroughFixtures: Set<string> | null,
  findings: string[],
): void {
  validateReadonlySchemas(source, findings);
  const label = sourceLabel(source);
  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement)) {
      findings.push(`${label}: default exports are forbidden; use named exports through @fixtures`);
    }
    if (!ts.isVariableStatement(statement) ||
        !hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const name = declaration.name.text;
      if (exportedThroughFixtures && !exportedThroughFixtures.has(name)) {
        findings.push(`${label}: exported data const "${name}" is not re-exported by @fixtures`);
      }
      if (declaration.initializer) {
        validateCatalog(name, declaration.initializer, source, findings);
      }
    }
  }
}

export function checkDataModuleSource(code: string, label: string): string[] {
  const source = ts.createSourceFile(label, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const findings: string[] = [];
  validateDataSource(source, null, findings);
  return findings;
}

export function checkCatalogLocationSource(code: string, label: string): string[] {
  const source = ts.createSourceFile(label, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const findings: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) ||
        !hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      if (catalogObject(declaration.initializer) && satisfiesRecord(declaration.initializer)) {
        findings.push(
          `${label}: typed fixture catalog "${declaration.name.text}" belongs under src/data/`,
        );
      }
    }
  }
  return findings;
}

function validateDataModules(findings: string[]): void {
  const exports = fixtureExports();
  for (const file of filesUnder(DATA_DIR, '.ts')) {
    validateDataSource(parseSource(file), exports, findings);
  }
}

function validateCatalogLocations(findings: string[]): void {
  for (const file of filesUnder(SRC_DIR, '.ts')) {
    if (file.startsWith(`${DATA_DIR}${path.sep}`)) continue;
    findings.push(...checkCatalogLocationSource(
      parseSource(file).getFullText(),
      rel(file),
    ));
  }
}

function validateGoldenDataset(findings: string[]): void {
  for (const file of filesUnder(CLEAN_GOLDEN_DIR, '.ts')) {
    const clean = checkDataModuleSource(parseSource(file).getFullText(), rel(file));
    if (clean.length > 0) {
      findings.push(`${rel(file)}: clean data golden failed: ${clean.join('; ')}`);
    }
  }

  const expected = new Map<string, string>([
    ['mutable-schema.ts', 'must be readonly'],
    ['untyped-catalog.ts', 'must use'],
    ['misplaced-catalog.ts', 'belongs under src/data/'],
  ]);
  for (const [name, marker] of expected) {
    const file = path.join(DIRTY_GOLDEN_DIR, name);
    if (!filesUnder(DIRTY_GOLDEN_DIR, '.ts').includes(file)) {
      findings.push(`${rel(file)}: missing data-gate golden`);
      continue;
    }
    const code = parseSource(file).getFullText();
    const dirty = name === 'misplaced-catalog.ts'
      ? checkCatalogLocationSource(code, rel(file))
      : checkDataModuleSource(code, rel(file));
    if (!dirty.some(finding => finding.includes(marker))) {
      findings.push(`${rel(file)}: no longer triggers expected "${marker}" finding`);
    }
  }
}

export function runDataGates(): string[] {
  const findings: string[] = [];
  validateDataModules(findings);
  validateCatalogLocations(findings);
  validateGoldenDataset(findings);
  return findings;
}
