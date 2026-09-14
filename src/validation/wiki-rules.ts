/**
 * Single parser for `wiki/`. The harness owns *how* to check; the wiki owns
 * *what* the business requires. No gate may embed a rule slug, a failure-mode
 * phrase, a UI element name, or a sensitive path — it reads them from here.
 *
 * Grammar (see wiki/business_domain.md and wiki/sensitive_domains.md):
 *
 *   N. **<Title>** (`<slug>`): <invariant>. <failure guidance>.
 *      Design: <Technique>[, <Technique>]
 *      Failure mode: <phrase>[ | <phrase>]
 *      Assertion: <locator> <matcher> requires <precondition call>
 *
 * `Design:` is required. The rest are optional per rule — a rule that
 * declares one gets a machine-enforced gate for free.
 */
import fs from 'node:fs';
import path from 'node:path';
import { filesUnder, rel, ROOT } from './shared.js';

const WIKI_DIR = path.join(ROOT, 'wiki');

const RULES_HEADING = '## business rules';
const SENSITIVE_HEADING = '## sensitive domains';

const RULE_HEADING = /^\d+\.[ \t]+\*\*[^*]+\*\*[ \t]+\(`([^`]+)`\):/;
const NUMBERED = /^\d+\.[ \t]+/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DESIGN_LINE = /^[ \t]*Design:[ \t]*(\S[^\n]*)$/i;
const FAILURE_LINE = /^[ \t]*Failure mode:[ \t]*(\S[^\n]*)$/i;
const ASSERTION_LINE = /^[ \t]*Assertion:[ \t]*(\S[^\n]*)$/i;
const ASSERTION_GRAMMAR = /^(\S+)[ \t]+(\S+)[ \t]+requires[ \t]+(\S+)$/i;
const SENTENCE_END = /[.!?](?:\s|$)/g;
const TEST_GUIDANCE = /\b(test|flag)\b/i;

const TECHNIQUE_ALIASES: Record<string, string> = {
  'equivalence partitioning': 'Equivalence Partitioning',
  ep: 'Equivalence Partitioning',
  'boundary value analysis': 'Boundary Value Analysis',
  bva: 'Boundary Value Analysis',
  'decision table': 'Decision Table',
  'state transition': 'State Transition',
  'error guessing': 'Error Guessing',
};

/** A spec-level contract: asserting `matcher` on `locator` needs `requires` first. */
export interface WikiAssertionContract {
  readonly locator: string;
  readonly matcher: string;
  readonly requires: string;
}

export interface WikiRule {
  readonly slug: string;
  readonly file: string;
  /** Techniques Stage 0c must inherit. */
  readonly techniques: Set<string>;
  /** Phrases that prove a designed case covers the rule's negative. */
  readonly failureModes: string[];
  readonly assertion: WikiAssertionContract | null;
}

export interface WikiCatalog {
  readonly slugs: Set<string>;
  readonly rules: Map<string, WikiRule>;
  /** Path segments declared by the wiki to force manual review. */
  readonly sensitiveDomains: string[];
  readonly findings: string[];
}

export function canonicalTechnique(raw: string): string | null {
  const trimmed = stripTrailingPeriods(raw);
  if (!trimmed) return null;
  return TECHNIQUE_ALIASES[trimmed.toLowerCase()] ?? null;
}

function stripTrailingPeriods(raw: string): string {
  let value = raw.trim();
  while (value.endsWith('.')) value = value.slice(0, -1).trimEnd();
  return value;
}

function section(source: string, heading: string): string | null {
  const headingIndex = source.toLowerCase().indexOf(heading);
  if (headingIndex < 0) return null;
  const bodyStart = source.indexOf('\n', headingIndex);
  if (bodyStart < 0) return null;
  const nextHeading = source.indexOf('\n## ', bodyStart + 1);
  return nextHeading < 0
    ? source.slice(bodyStart + 1)
    : source.slice(bodyStart + 1, nextHeading);
}

function parseTechniques(listed: string, slug: string, file: string, findings: string[]): Set<string> {
  const techniques = new Set<string>();
  for (const part of listed.split(',')) {
    const technique = canonicalTechnique(part);
    if (!technique) {
      findings.push(`${rel(file)}: rule "${slug}" Design lists an unknown technique`);
      continue;
    }
    if (techniques.has(technique)) {
      findings.push(`${rel(file)}: rule "${slug}" Design repeats "${technique}"`);
    }
    techniques.add(technique);
  }
  if (techniques.size === 0) {
    findings.push(`${rel(file)}: rule "${slug}" Design must list at least one technique`);
  }
  return techniques;
}

function parseFailureModes(listed: string, slug: string, file: string, findings: string[]): string[] {
  const phrases = listed
    .split('|')
    .map(stripTrailingPeriods)
    .filter(Boolean);
  if (phrases.length === 0) {
    findings.push(`${rel(file)}: rule "${slug}" Failure mode must list at least one phrase`);
  }
  return phrases;
}

function parseAssertion(
  listed: string,
  slug: string,
  file: string,
  findings: string[],
): WikiAssertionContract | null {
  const match = stripTrailingPeriods(listed).match(ASSERTION_GRAMMAR);
  if (!match) {
    findings.push(
      `${rel(file)}: rule "${slug}" Assertion must read "<locator> <matcher> requires <call>"`,
    );
    return null;
  }
  return { locator: match[1], matcher: match[2], requires: match[3] };
}

/** Collect the numbered `(slug)` entries of one section, with their sub-lines. */
function eachEntry(
  body: string,
  file: string,
  seen: Set<string>,
  findings: string[],
  visit: (slug: string, prose: string, lines: string[]) => void,
): void {
  const lines = body.split('\n');
  for (const [index, line] of lines.entries()) {
    const heading = line.match(RULE_HEADING);
    if (!heading) {
      if (NUMBERED.test(line)) {
        findings.push(`${rel(file)}: malformed entry heading: ${line.trim()}`);
      }
      continue;
    }
    const slug = heading[1];
    if (!SLUG.test(slug)) findings.push(`${rel(file)}: invalid slug "${slug}"`);
    if (seen.has(slug)) findings.push(`${rel(file)}: duplicate slug "${slug}"`);
    seen.add(slug);

    const prose: string[] = [line];
    const structured: string[] = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (NUMBERED.test(lines[next])) break;
      if (DESIGN_LINE.test(lines[next]) ||
          FAILURE_LINE.test(lines[next]) ||
          ASSERTION_LINE.test(lines[next])) {
        structured.push(lines[next]);
        continue;
      }
      prose.push(lines[next]);
    }
    visit(slug, prose.join(' ').trim(), structured);
  }
}

function parseRuleFile(file: string, catalog: WikiCatalog): void {
  const source = fs.readFileSync(file, 'utf8');
  const body = section(source, RULES_HEADING);
  if (body === null) return;

  eachEntry(body, file, catalog.slugs, catalog.findings, (slug, prose, structured) => {
    const sentences = prose.match(SENTENCE_END)?.length ?? 0;
    if (sentences > 3) catalog.findings.push(`${rel(file)}: rule "${slug}" exceeds 3 sentences`);
    if (!TEST_GUIDANCE.test(prose)) {
      catalog.findings.push(`${rel(file)}: rule "${slug}" lacks test/failure guidance`);
    }

    let techniques = new Set<string>();
    let failureModes: string[] = [];
    let assertion: WikiAssertionContract | null = null;
    let hasDesign = false;

    for (const line of structured) {
      const design = line.match(DESIGN_LINE);
      if (design) {
        hasDesign = true;
        techniques = parseTechniques(design[1], slug, file, catalog.findings);
        continue;
      }
      const failure = line.match(FAILURE_LINE);
      if (failure) {
        failureModes = parseFailureModes(failure[1], slug, file, catalog.findings);
        continue;
      }
      const contract = line.match(ASSERTION_LINE);
      if (contract) {
        assertion = parseAssertion(contract[1], slug, file, catalog.findings);
      }
    }

    if (!hasDesign) {
      catalog.findings.push(`${rel(file)}: rule "${slug}" lacks a Design: technique line`);
    }
    catalog.rules.set(slug, { slug, file, techniques, failureModes, assertion });
  });
}

function parseSensitiveFile(file: string, catalog: WikiCatalog, seen: Set<string>): void {
  const source = fs.readFileSync(file, 'utf8');
  const body = section(source, SENSITIVE_HEADING);
  if (body === null) return;
  eachEntry(body, file, seen, catalog.findings, slug => {
    catalog.sensitiveDomains.push(slug);
  });
}

export function loadWikiCatalog(): WikiCatalog {
  const catalog: WikiCatalog = {
    slugs: new Set<string>(),
    rules: new Map<string, WikiRule>(),
    sensitiveDomains: [],
    findings: [],
  };

  const files = filesUnder(WIKI_DIR, '.md');
  for (const file of files) parseRuleFile(file, catalog);

  const sensitiveSeen = new Set<string>();
  for (const file of files) parseSensitiveFile(file, catalog, sensitiveSeen);

  if (catalog.slugs.size === 0) catalog.findings.push('wiki/: no business-rule slugs found');
  if (catalog.sensitiveDomains.length === 0) {
    catalog.findings.push('wiki/: no "## Sensitive domains" section declares a manual-review domain');
  }
  return catalog;
}
