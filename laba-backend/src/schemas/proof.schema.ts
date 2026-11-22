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
  // Small JPEG data URL (thumbnail) stored for admin audit
  selfie: z
    .string()
    .regex(/^data:image\/jpeg;base64,/, 'Selfie must be a JPEG data URL')
    .max(120_000, 'Selfie image is too large'),
});

export type GpsProof = z.infer<typeof gpsProofSchema>;
export type FaceProof = z.infer<typeof faceProofSchema>;
