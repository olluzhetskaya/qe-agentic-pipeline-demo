// DIRTY: this valid typed catalog represents a fixture catalog outside src/data/.
export interface MisplacedFixture {
  readonly id: string;
}

export const MisplacedFixtures = {
  sample: {
    id: 'sample-misplaced',
  },
} as const satisfies Record<string, MisplacedFixture>;
