export const testTimeouts = {
  standard: 30_000,
  extended: 60_000,
  expect: 10_000,
} as const;

export const Tags = {
  smoke: '@smoke',
  gcrm: '@gcrm',
  lcrm: '@lcrm',
} as const;
