export interface Account {
  name: string;
  type?: string;
  industry?: string;
}

export const Accounts = {
  existingAccount: {
    name: 'Test Account for Opportunities',
    type: 'Customer',
    industry: 'Healthcare',
  },
  accountData: {
    name: 'New Test Account',
    type: 'Prospect',
    industry: 'Technology',
  },
  accountWithContract: {
    name: 'Amendment Test Account',
    type: 'Customer',
    industry: 'Healthcare',
  },
} as const satisfies Record<string, Account>;
