export interface User {
  username: string;
  password: string;
  role: string;
  system: 'GCRM' | 'LCRM';
}

export const Users = {
  salesUser: {
    username: process.env.GCRM_SALES_USER || 'sales@test.com',
    password: process.env.GCRM_SALES_PASSWORD || 'password',
    role: 'Sales',
    system: 'GCRM',
  },
  adminUser: {
    username: process.env.GCRM_ADMIN_USER || 'admin@test.com',
    password: process.env.GCRM_ADMIN_PASSWORD || 'password',
    role: 'Admin',
    system: 'GCRM',
  },
} as const satisfies Record<string, User>;
