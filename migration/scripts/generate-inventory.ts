#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LEGACY_ROOT = path.resolve(ROOT, '..', '..', 'legacy-ta-framework');
const FEATURES_DIR = path.join(LEGACY_ROOT, 'packages/cucumber-tests/src/features');
const INVENTORY_PATH = path.join(ROOT, 'data/inventory.json');

function parseFeatureFile(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let featureName = '';
  let featureTags: string[] = [];
  const scenarios: any[] = [];
  let currentScenario: any = null;
  let inScenario = false;
  let inExamples = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('Feature:')) {
      featureName = line.substring(8).trim();
      // Check for tags on previous line
      if (i > 0 && lines[i-1].trim().startsWith('@')) {
        featureTags = lines[i-1].trim().split(/\s+/).filter(t => t.startsWith('@'));
      }
    } else if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
      if (currentScenario && inScenario) {
        scenarios.push(currentScenario);
      }
      
      const scenarioName = line.replace(/^Scenario(?: Outline)?:\s*/, '').trim();
      const scenarioTags: string[] = [];
      
      // Check for tags on previous lines
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = lines[j].trim();
        if (prevLine.startsWith('@')) {
          scenarioTags.unshift(...prevLine.split(/\s+/).filter(t => t.startsWith('@')));
        } else if (prevLine === '' || prevLine.startsWith('#')) {
          continue;
        } else {
          break;
        }
      }
      
      currentScenario = {
        name: scenarioName,
        tags: scenarioTags,
        steps: [],
        examples: null
      };
      inScenario = true;
      inExamples = false;
    } else if (inScenario && !inExamples && line.match(/^(Given|When|Then|And|But)\s+/)) {
      const match = line.match(/^(Given|When|Then|And|But)\s+(.+)$/);
      if (match && currentScenario) {
        currentScenario.steps.push({
          keyword: match[1],
          text: match[2],
          glue: null
        });
      }
    } else if (line.startsWith('Examples:')) {
      inExamples = true;
      currentScenario.examples = [];
    } else if (inExamples && line.startsWith('|')) {
      // Skip examples content for now
    }
  }
  
  if (currentScenario && inScenario) {
    scenarios.push(currentScenario);
  }
  
  return { featureName, featureTags, scenarios };
}

function findFeatureFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) return files;
  
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.name === 'node_modules') continue;
    
    if (entry.isDirectory()) {
      files.push(...findFeatureFiles(fullPath, baseDir));
    } else if (entry.name.endsWith('.feature')) {
      files.push(path.relative(LEGACY_ROOT, fullPath));
    }
  }
  
  return files;
}

const featurePaths = findFeatureFiles(FEATURES_DIR).sort();

const features = featurePaths.map(relativePath => {
  const fullPath = path.join(LEGACY_ROOT, relativePath);
  const parsed = parseFeatureFile(fullPath);
  
  return {
    path: relativePath,
    name: parsed.featureName,
    tags: parsed.featureTags,
    scenarios: parsed.scenarios
  };
});

const inventory = {
  sut_root: '../../legacy-ta-framework',
  source_framework: 'cucumber',
  target_framework: 'playwright',
  status: 'AUTO_PROCEED',
  reason: null,
  escalate: null,
  features,
  step_definitions: [
    { path: 'packages/cucumber-tests/src/features/GCRM/steps/AccountCreation.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/GCRM/steps/Amendment.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/GCRM/steps/AuditScripts.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/GCRM/steps/ContractActivation.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/GCRM/steps/Dashboard.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/GCRM/steps/GlobalSearch.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/GCRM/steps/OpportunityCreation.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/GCRM/steps/OrderGeneration.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/GCRM/steps/QuoteApproval.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/GCRM/steps/QuoteCreation.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/LCRM/steps/DataTraversalVerification.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/LCRM/steps/LVIslandDataTraversal.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/LCRM/steps/NASFGeneration.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/LCRM/steps/PostSalesDataGeneration.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/common/steps/AccountRelated.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/common/steps/EditRecord.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/common/steps/Login.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/common/steps/Navigation.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/common/steps/OpportunityRelated.steps.ts', patterns: [] },
    { path: 'packages/cucumber-tests/src/features/common/steps/QuoteRelated.steps.ts', patterns: [] }
  ],
  hooks: [
    { path: 'packages/cucumber-tests/src/support/cucumber/common-hooks.ts' },
    { path: 'packages/cucumber-tests/src/support/cucumber/custom-world.ts' },
    { path: 'packages/cucumber-tests/src/support/cucumber/gcrm-hooks.ts' },
    { path: 'packages/cucumber-tests/src/support/cucumber/lcrm-hooks.ts' }
  ]
};

fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2) + '\n');

process.stdout.write(`Inventory generated: ${features.length} features, ${features.reduce((sum, f) => sum + f.scenarios.length, 0)} scenarios\n`);
