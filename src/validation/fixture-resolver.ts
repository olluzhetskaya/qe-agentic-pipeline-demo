/**
 * Generic fixture-handle resolver shared by read-only projections.
 *
 * Validation owns the set of allowed handles. Runtime module loading supplies
 * their current values without naming a tenant, plan, employee, or catalog in
 * the harness. Xray publishing and the artifact inspector can therefore use
 * the same resolution behavior.
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { getProperty } from 'dot-prop';
import { collectFixtureHandles, filesUnder, ROOT } from './shared.js';

const DATA_DIR = path.join(ROOT, 'src/data');

export interface FixtureResolution {
  readonly handle: string;
  readonly found: boolean;
  readonly value: unknown;
}

export interface FixtureResolver {
  readonly handles: ReadonlySet<string>;
  resolve(handle: string): FixtureResolution;
}

export async function loadFixtureResolver(): Promise<FixtureResolver> {
  const roots: Record<string, unknown> = {};
  for (const file of filesUnder(DATA_DIR, '.ts')) {
    const module = await import(pathToFileURL(file).href) as Record<string, unknown>;
    Object.assign(roots, module);
  }

  const handles = collectFixtureHandles();
  return {
    handles,
    resolve(handle: string): FixtureResolution {
      if (!handles.has(handle)) return { handle, found: false, value: null };
      const value = getProperty(roots, handle);
      return { handle, found: value !== undefined, value: value ?? null };
    },
  };
}
