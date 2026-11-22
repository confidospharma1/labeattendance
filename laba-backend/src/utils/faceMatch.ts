/**
 * Server-side face descriptor comparison.
 *
 * Mirrors `similarity()` from @vladmandic/human (src/face/match.ts, v3.3.x) so the
 * server makes the final match decision instead of trusting the phone.
 * Descriptors are produced on-device by the Human `faceres` model.
 */

export type Descriptor = number[];

const ORDER = 2;
const MULTIPLIER = 25;
const MIN = 0.2;
const MAX = 0.8;

export const FACE_MODEL_VERSION = 'human-3.3-faceres';

function distance(a: Descriptor, b: Descriptor): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.round(100 * MULTIPLIER * sum) / 100;
}

function normalizeDistance(dist: number): number {
  if (dist === 0) return 1;
  const root = ORDER === 2 ? Math.sqrt(dist) : dist ** (1 / ORDER);
  const norm = (1 - root / 100 - MIN) / (MAX - MIN);
  return Math.round(100 * Math.max(Math.min(norm, 1), 0)) / 100;
}

/** Normalised similarity in 0..1. Values above ~0.5 are generally the same person. */
export function faceSimilarity(a: Descriptor, b: Descriptor): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length < 64) return 0;
  return normalizeDistance(distance(a, b));
}

/** Best similarity of a probe descriptor against all enrolled samples. */
export function bestFaceSimilarity(probe: Descriptor, enrolled: Descriptor[]): number {
  let best = 0;
  for (const sample of enrolled) {
    best = Math.max(best, faceSimilarity(probe, sample));
  }
  return best;
}

export function isValidDescriptor(d: unknown): d is Descriptor {
  return Array.isArray(d) && d.length >= 64 && d.length <= 2048 && d.every((v) => typeof v === 'number' && Number.isFinite(v));
}
