/**
 * Standing PASS cutoff. This is a policy number, not a measured threshold.
 * golden_dataset/ primes the judge; it is not a blinded holdout.
 */
export const CONFIDENCE_THRESHOLD = 75;
export const THRESHOLD_BASIS = 'policy';

export function assertConfidencePolicy(
  record: { threshold?: unknown; threshold_basis?: unknown },
  label: string,
  findings: string[],
): number {
  if (record.threshold !== CONFIDENCE_THRESHOLD) {
    findings.push(
      `${label}: threshold must be ${CONFIDENCE_THRESHOLD} (standing policy cutoff)`,
    );
  }
  if (record.threshold_basis !== THRESHOLD_BASIS) {
    findings.push(`${label}: threshold_basis must be "${THRESHOLD_BASIS}"`);
  }
  return CONFIDENCE_THRESHOLD;
}
