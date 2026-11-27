import { z } from 'zod';

/** GPS fix captured on the device at the moment of an attendance action. */
export const gpsProofSchema = z.object({
  latitude: z.number({ required_error: 'Latitude is required' }).min(-90).max(90),
  longitude: z.number({ required_error: 'Longitude is required' }).min(-180).max(180),
  accuracy: z.number({ required_error: 'GPS accuracy is required' }).min(0),
  isMockLocation: z.boolean().optional(),
});

/** Face capture produced by the on-device face model. */
export const faceProofSchema = z.object({
  descriptor: z.array(z.number()).min(64).max(2048),
  liveness: z.number().min(0).max(1),
  antispoof: z.number().min(0).max(1),
  blinkDetected: z.boolean(),
  // Older app versions still send a selfie thumbnail; it is accepted but never stored (saves database space).
  selfie: z.string().max(120_000, 'Selfie image is too large').optional(),
});

export type GpsProof = z.infer<typeof gpsProofSchema>;
export type FaceProof = z.infer<typeof faceProofSchema>;
