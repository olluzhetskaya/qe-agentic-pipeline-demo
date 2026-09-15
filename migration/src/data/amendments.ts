export interface AmendmentOpportunityData {
  subtype: string;
  numberOfLives: string;
  subTypeDetail: string;
}

export interface DiabetesLineEditData {
  perUnitDiscount: string;
  expectedNetARR: string;
  expectedParticipantQuantity: string;
  expectedQuantity: string;
  expectedSubscriptionFee: string;
}

export const AmendmentOpportunities = {
  amendmentOpportunityData: {
    subtype: 'Change Order',
    numberOfLives: '500',
    subTypeDetail: 'Add-On Membership',
  },
} as const satisfies Record<string, AmendmentOpportunityData>;

export const DiabetesLineEdits = {
  diabetesLineEditData: {
    perUnitDiscount: '-3',
    expectedNetARR: 'USD 7,020.00',
    expectedParticipantQuantity: '30',
    expectedQuantity: '7.50',
    expectedSubscriptionFee: 'USD 78.00',
  },
} as const satisfies Record<string, DiabetesLineEditData>;
