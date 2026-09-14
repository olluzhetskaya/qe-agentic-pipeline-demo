// GOLDEN: a domain-neutral fixture module with an immutable schema and typed catalog.
export interface SampleFixture {
  readonly id: string;
  readonly label: string;
}

export const SampleFixtures = {
  primary: {
    id: 'sample-clean-01',
    label: 'Primary sample',
  },
  secondary: {
    id: 'sample-clean-02',
    label: 'Secondary sample',
  },
} as const satisfies Record<string, SampleFixture>;
