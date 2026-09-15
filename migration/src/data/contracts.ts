export interface Contract {
  id?: string;
  type: string;
  accountName: string;
}

export const Contracts = {
  recurringServicesContract: {
    type: 'Recurring Services',
    accountName: 'Amendment Test Account',
  },
} as const satisfies Record<string, Contract>;
