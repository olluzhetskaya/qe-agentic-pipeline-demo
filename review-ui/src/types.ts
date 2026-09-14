export interface AcceptanceCriterion {
  id: string;
  text: string;
  type: string;
  grade: string;
  confidence: number;
}

export interface RequirementArtifact {
  id: string;
  type: string;
  title: string | null;
  description: string | null;
  analysis_confidence: {
    score: number;
    threshold: number;
    threshold_basis: 'policy';
    rationale: string;
  };
  analysis_decision: {
    status: 'AUTO_PROCEED' | 'WAITING';
    reason: string | null;
    escalate: string[] | null;
  };
  acceptance_criteria: AcceptanceCriterion[];
  wiki_refs: string[];
}

export interface TestObjective {
  id: string;
  name: string;
  covers_ac: string[];
  wiki_rule: string;
  automation_candidacy: string;
  notes: string | null;
}

export interface TestStep {
  action: string;
  data: string;
  result: string;
}

export interface TestCase {
  id: string;
  title: string;
  priority: string;
  linked_objective: string;
  covers_ac: string[];
  ac_text: string[];
  technique: string[];
  automation_status: string;
  automated_by: string | null;
  xray_key: string | null;
  preconditions: string[];
  steps: TestStep[];
}

export interface TestDesignArtifact {
  requirement_id: string;
  project_key: string;
  test_objectives: TestObjective[];
  test_cases: TestCase[];
}

export interface ReviewSnapshot {
  generated_at: string;
  read_only: true;
  gates: Array<{
    direction: string;
    pass: boolean;
    findings: string[];
  }>;
  requirement: RequirementArtifact;
  design: TestDesignArtifact;
  wiki: {
    rules: Array<{
      slug: string;
      file: string;
      techniques: string[];
      failure_modes: string[];
      assertion: {
        locator: string;
        matcher: string;
        requires: string;
      } | null;
    }>;
    sensitive_domains: string[];
    findings: string[];
  };
  fixture_resolutions: Array<{
    handle: string;
    found: boolean;
    value: unknown;
  }>;
}
