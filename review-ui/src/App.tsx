import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import { JsonView, collapseAllNested } from 'react-json-view-lite';
import '@xyflow/react/dist/style.css';
import 'react-json-view-lite/dist/index.css';
import type { ReviewSnapshot, TestCase, TestObjective } from './types';

type View = 'overview' | 'traceability' | 'cases' | 'raw';

type Tone = 'pass' | 'fail' | 'neutral';

function Badge({ pass, tone, title, children }: {
  pass?: boolean;
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
}) {
  const resolved: Tone = tone ?? (pass ? 'pass' : 'fail');
  return <span className={`badge ${resolved}`} title={title}>{children}</span>;
}

/** PASS and FAIL are verdicts; SKIP is the required state for a judge/NFR AC. */
function gradeTone(grade: string): Tone {
  if (grade === 'PASS') return 'pass';
  if (grade === 'FAIL') return 'fail';
  return 'neutral';
}

/** AC id → objectives claiming it, straight from design.test_objectives.covers_ac. */
function coverageByCriterion(snapshot: ReviewSnapshot): Map<string, TestObjective[]> {
  const map = new Map<string, TestObjective[]>();
  for (const objective of snapshot.design.test_objectives) {
    for (const criterionId of objective.covers_ac) {
      map.set(criterionId, [...(map.get(criterionId) ?? []), objective]);
    }
  }
  return map;
}

function GateStrip({ snapshot }: { snapshot: ReviewSnapshot }) {
  return (
    <section className="gate-strip" aria-label="Deterministic gate status">
      {snapshot.gates.map(gate => (
        <div className="gate" key={gate.direction}>
          <span>{gate.direction}</span>
          <Badge pass={gate.pass}>{gate.pass ? 'PASS' : `${gate.findings.length} FAIL`}</Badge>
        </div>
      ))}
    </section>
  );
}

function Overview({ snapshot }: { snapshot: ReviewSnapshot }) {
  const { requirement, design } = snapshot;
  const coverage = coverageByCriterion(snapshot);
  const casesByObjective = (objectiveId: string) =>
    design.test_cases.filter(testCase => testCase.linked_objective === objectiveId);
  const casesByCriterion = (criterionId: string) =>
    design.test_cases.filter(testCase => testCase.covers_ac.includes(criterionId));
  return (
    <div className="overview-grid">
      <section className="hero-panel">
        <p className="eyebrow">{requirement.id} · {requirement.type}</p>
        <h2>{requirement.title ?? 'Untitled requirement'}</h2>
        <p>{requirement.description}</p>
        <div className="confidence">
          <strong>{requirement.analysis_confidence.score}/100</strong>
          <span>{requirement.analysis_confidence.rationale}</span>
          <Badge
            tone={requirement.analysis_decision.status === 'AUTO_PROCEED' ? 'pass' : 'fail'}
          >
            {requirement.analysis_decision.status}
          </Badge>
        </div>
      </section>

      <section className="metric-panel">
        <div><strong>{requirement.acceptance_criteria.length}</strong><span>acceptance criteria</span></div>
        <div><strong>{design.test_objectives.length}</strong><span>objectives</span></div>
        <div><strong>{design.test_cases.length}</strong><span>test cases</span></div>
        <div><strong>{snapshot.fixture_resolutions.length}</strong><span>fixture handles</span></div>
      </section>

      <section className="wide-panel">
        <div className="section-title">
          <h3>Acceptance criteria</h3>
          <span>
            Persisted Stage 0a assessment · deterministic ACs must be PASS,
            judge/NFR ACs must be SKIP (not automation candidates)
          </span>
        </div>
        <div className="ac-list">
          {requirement.acceptance_criteria.map(ac => {
            const covering = coverage.get(ac.id) ?? [];
            const inScope = ac.type === 'deterministic';
            return (
              <article className="ac-row" key={ac.id}>
                <code>{ac.id}</code>
                <p>
                  {ac.text}
                  <em className="coverage-note">
                    {covering.length > 0
                      ? `Covered by ${covering.map(objective => objective.id).join(', ')} · exercised by ${
                          casesByCriterion(ac.id).map(testCase => testCase.id).join(', ') || 'no case'}`
                      : inScope
                        ? 'No objective claims this criterion'
                        : 'Out of automation scope — no objective expected'}
                  </em>
                </p>
                <span>{ac.type}</span>
                <Badge
                  tone={gradeTone(ac.grade)}
                  title={ac.grade === 'SKIP'
                    ? 'SKIP is the expected grade for a judge/NFR criterion — out of automation scope, not a failure'
                    : undefined}
                >
                  {ac.grade}
                </Badge>
                <strong>{ac.confidence}</strong>
              </article>
            );
          })}
        </div>
      </section>

      <section className="wide-panel">
        <div className="section-title">
          <h3>Test objectives</h3>
          <span>Each objective declares the criteria it covers; [] means wiki-rule-derived only</span>
        </div>
        <div className="objective-list">
          {design.test_objectives.map(objective => (
            <article className="objective-row" key={objective.id}>
              <code>{objective.id}</code>
              <div>
                <strong>{objective.name}</strong>
                <p>
                  <span className="tag">{objective.wiki_rule}</span>
                  {' covers '}
                  {objective.covers_ac.length > 0
                    ? objective.covers_ac.join(', ')
                    : 'no acceptance criterion'}
                  {' · cases '}
                  {casesByObjective(objective.id).map(testCase => testCase.id).join(', ') || 'none'}
                </p>
                {objective.notes && <p className="coverage-note">{objective.notes}</p>}
              </div>
              <Badge tone={objective.covers_ac.length > 0 ? 'pass' : 'neutral'}>
                {objective.automation_candidacy}
              </Badge>
            </article>
          ))}
        </div>
      </section>

      <section className="wide-panel">
        <div className="section-title">
          <h3>Resolved test data</h3>
          <span>Source: typed catalogs under src/data/</span>
        </div>
        <div className="resolution-list">
          {snapshot.fixture_resolutions.map(item => (
            <div className="resolution" key={item.handle}>
              <code>{item.handle}</code>
              <span>→</span>
              <output>{item.found ? JSON.stringify(item.value) : 'UNRESOLVED'}</output>
              <Badge pass={item.found}>{item.found ? 'FOUND' : 'MISSING'}</Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Traceability({ snapshot }: { snapshot: ReviewSnapshot }) {
  const { requirement, design } = snapshot;
  const graph = useMemo(() => {
    const nodes: Node[] = [{
      id: requirement.id,
      position: { x: 0, y: 240 },
      data: { label: <><small>REQUIREMENT</small><strong>{requirement.id}</strong></> },
      className: 'flow-node requirement-node',
    }];
    const edges: Edge[] = [];
    const arrow = { type: MarkerType.ArrowClosed } as const;

    requirement.acceptance_criteria.forEach((ac, index) => {
      nodes.push({
        id: ac.id,
        position: { x: 320, y: index * 130 },
        data: { label: <><small>{ac.type.toUpperCase()} · {ac.grade}</small><strong>{ac.id} — {ac.text}</strong></> },
        className: `flow-node ac-node${ac.type === 'deterministic' ? '' : ' out-of-scope'}`,
      });
      edges.push({
        id: `${requirement.id}-${ac.id}`,
        source: requirement.id,
        target: ac.id,
        markerEnd: arrow,
      });
    });

    design.test_objectives.forEach((objective, index) => {
      nodes.push({
        id: objective.id,
        position: { x: 700, y: index * 200 },
        data: { label: <><small>OBJECTIVE · {objective.wiki_rule}</small><strong>{objective.name}</strong></> },
        className: 'flow-node objective-node',
      });
      // No covers_ac means the objective hangs off the wiki rule, not a criterion.
      const parents = objective.covers_ac.length > 0 ? objective.covers_ac : [requirement.id];
      for (const parent of parents) {
        edges.push({
          id: `${parent}-${objective.id}`,
          source: parent,
          target: objective.id,
          label: objective.covers_ac.length > 0 ? undefined : 'wiki rule only, no AC',
          style: objective.covers_ac.length > 0 ? undefined : { strokeDasharray: '5 4' },
          markerEnd: arrow,
        });
      }
    });

    design.test_cases.forEach((testCase, index) => {
      nodes.push({
        id: testCase.id,
        position: { x: 1080, y: index * 155 },
        data: { label: <><small>CASE · {testCase.priority}</small><strong>{testCase.title}</strong></> },
        className: 'flow-node case-node',
      });
      edges.push({
        id: `${testCase.linked_objective}-${testCase.id}`,
        source: testCase.linked_objective,
        target: testCase.id,
        markerEnd: arrow,
      });
      if (testCase.automated_by) {
        const specId = `spec-${index}`;
        nodes.push({
          id: specId,
          position: { x: 1460, y: index * 155 },
          data: { label: <><small>AUTOMATION</small><strong>{testCase.automated_by}</strong></> },
          className: 'flow-node spec-node',
        });
        edges.push({
          id: `${testCase.id}-${specId}`,
          source: testCase.id,
          target: specId,
          markerEnd: arrow,
        });
      }
    });
    return { nodes, edges };
  }, [design, requirement]);

  return (
    <section className="flow-wrap">
      <div className="section-title">
        <h3>Requirement → acceptance criterion → objective → case → automation</h3>
        <span>Drag and zoom for inspection; graph is read-only</span>
      </div>
      <div className="flow-canvas">
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodesConnectable={false}
          elementsSelectable
          fitView
          minZoom={0.35}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}

function CaseCard({ testCase, snapshot }: { testCase: TestCase; snapshot: ReviewSnapshot }) {
  const objective = snapshot.design.test_objectives
    .find(item => item.id === testCase.linked_objective);
  return (
    <details className="case-card">
      <summary>
        <code>{testCase.id}</code>
        <strong>{testCase.title}</strong>
        <span>
          {testCase.covers_ac.length > 0 ? testCase.covers_ac.join(', ') : 'no AC'}
          {' · '}{objective?.wiki_rule}
        </span>
        <Badge tone={testCase.automation_status === 'Automated' ? 'pass' : 'neutral'}>
          {testCase.automation_status}
        </Badge>
      </summary>
      <div className="case-body">
        <p>
          <b>Covers:</b>{' '}
          {testCase.covers_ac.length > 0
            ? testCase.covers_ac.map(criterionId => {
                const criterion = snapshot.requirement.acceptance_criteria
                  .find(item => item.id === criterionId);
                return <span className="ac-cited" key={criterionId}>
                  <code>{criterionId}</code> {criterion?.text ?? 'not in requirement artifact'}
                </span>;
              })
            : 'no acceptance criterion'}
        </p>
        <p><b>Objective:</b> {objective?.id} — {objective?.name}</p>
        <p><b>Techniques:</b> {testCase.technique.join(', ')}</p>
        <p><b>Preconditions:</b> {testCase.preconditions.join(' · ')}</p>
        <div className="steps">
          {testCase.steps.map((step, index) => (
            <div className="step" key={`${testCase.id}-${index}`}>
              <span>{index + 1}</span>
              <div><small>ACTION</small><p>{step.action}</p></div>
              <div><small>DATA</small><code>{step.data}</code></div>
              <div><small>EXPECTED</small><p>{step.result}</p></div>
            </div>
          ))}
        </div>
        <p><b>Automation:</b> <code>{testCase.automated_by ?? 'not linked'}</code></p>
        <p><b>Xray:</b> <code>{testCase.xray_key ?? 'not published'}</code></p>
      </div>
    </details>
  );
}

function Cases({ snapshot }: { snapshot: ReviewSnapshot }) {
  return (
    <section>
      <div className="section-title">
        <h3>Manual test design</h3>
        <span>Action / Data / Expected Result · each case names the criteria it exercises</span>
      </div>
      <div className="case-list">
        {snapshot.design.test_cases.map(testCase =>
          <CaseCard key={testCase.id} testCase={testCase} snapshot={snapshot} />)}
      </div>
    </section>
  );
}

function RawArtifacts({ snapshot }: { snapshot: ReviewSnapshot }) {
  return (
    <div className="raw-grid">
      <section>
        <h3>Requirement artifact</h3>
        <JsonView data={snapshot.requirement} shouldExpandNode={collapseAllNested} />
      </section>
      <section>
        <h3>Test-design artifact</h3>
        <JsonView data={snapshot.design} shouldExpandNode={collapseAllNested} />
      </section>
      <section>
        <h3>Parsed wiki catalog</h3>
        <JsonView data={snapshot.wiki} shouldExpandNode={collapseAllNested} />
      </section>
    </div>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<ReviewSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('overview');

  useEffect(() => {
    fetch('/review-data.json')
      .then(response => {
        if (!response.ok) throw new Error(`Snapshot request failed: ${response.status}`);
        return response.json() as Promise<ReviewSnapshot>;
      })
      .then(setSnapshot)
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  if (error) return <main className="state"><h1>Artifact inspector unavailable</h1><p>{error}</p></main>;
  if (!snapshot) return <main className="state"><h1>Loading review snapshot…</h1></main>;

  const allPass = snapshot.gates.every(gate => gate.pass);
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">OPTIONAL · READ-ONLY</p>
          <h1>QE Artifact Inspector</h1>
          <p>Human review surface over existing artifacts. Gates remain authoritative.</p>
        </div>
        <div className="header-status">
          <Badge pass={allPass}>{allPass ? 'ALL GATES PASS' : 'GATE FINDINGS'}</Badge>
          <small>Snapshot {new Date(snapshot.generated_at).toLocaleString()}</small>
        </div>
      </header>

      <GateStrip snapshot={snapshot} />
      <nav aria-label="Inspector views">
        {(['overview', 'traceability', 'cases', 'raw'] as View[]).map(item => (
          <button className={view === item ? 'active' : ''} key={item} onClick={() => setView(item)}>
            {item}
          </button>
        ))}
      </nav>

      {view === 'overview' && <Overview snapshot={snapshot} />}
      {view === 'traceability' && <Traceability snapshot={snapshot} />}
      {view === 'cases' && <Cases snapshot={snapshot} />}
      {view === 'raw' && <RawArtifacts snapshot={snapshot} />}
    </main>
  );
}
