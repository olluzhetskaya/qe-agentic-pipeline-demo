export interface Product {
  name: string;
  perUnitDiscount?: number;
}

export const Products = {
  diabetesManagementProduct: {
    name: 'Diabetes Management',
  },
  hypertensionManagementPlusProduct: {
    name: 'Hypertension Management Plus',
  },
} as const satisfies Record<string, Product>;
