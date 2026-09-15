export interface Opportunity {
  name: string;
  stage?: string;
  closeDate?: string;
}

export const Opportunities = {
  opportunityData: {
    name: 'New Sales Opportunity',
    stage: 'Prospecting',
    closeDate: '2026-12-31',
  },
} as const satisfies Record<string, Opportunity>;
