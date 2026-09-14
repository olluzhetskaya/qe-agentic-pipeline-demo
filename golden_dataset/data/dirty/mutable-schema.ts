// DIRTY: exported fixture schema fields must be immutable.
export interface MutableFixture {
  id: string;
  readonly label: string;
}

export const MutableFixtures = {
  sample: {
    id: 'sample-mutable-schema',
    label: 'Mutable schema sample',
  },
} as const satisfies Record<string, MutableFixture>;
