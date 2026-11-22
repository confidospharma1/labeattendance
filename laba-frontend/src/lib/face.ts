/**
 * On-device face engine (@vladmandic/human, MIT). Models are served from /models
 * (copied by scripts/copy-face-models.js) so they also work offline inside the APK.
 * The phone only produces a descriptor + liveness scores; the server decides the match.
 */
import type { Human, Config, Result } from '@vladmandic/human';

let humanPromise: Promise<Human> | null = null;

const config: Partial<Config> = {
  modelBasePath: '/models/',
  backend: 'webgl',
  debug: false,
  cacheSensitivity: 0,
  filter: { enabled: true, equalization: false, flip: false } as any,
  face: {
    enabled: true,
    detector: { rotation: false, maxDetected: 2, minConfidence: 0.5, return: false } as any,
    mesh: { enabled: true } as any,
    attention: { enabled: false } as any,
    iris: { enabled: true } as any,
    description: { enabled: true } as any,
    emotion: { enabled: false } as any,
    antispoof: { enabled: true } as any,
    liveness: { enabled: true } as any,
  } as any,
  body: { enabled: false } as any,
  hand: { enabled: false } as any,
  object: { enabled: false } as any,
  segmentation: { enabled: false } as any,
  gesture: { enabled: true },
};

export function getHuman(): Promise<Human> {
  if (!humanPromise) {
    humanPromise = (async () => {
      const { Human } = await import('@vladmandic/human');
      const human = new Human(config);
      try {
        await human.load();
      } catch {
        // WebGL unavailable on some phones: fall back to the slower CPU backend
        human.config.backend = 'cpu';
        await human.load();
      }
      await human.warmup();
      return human;
    })().catch((e) => {
      humanPromise = null;
      throw e;
    });
  }
  return humanPromise;
}

export interface FaceFrame {
  faces: number;
  faceScore: number;
  descriptor: number[] | null;
  real: number;
  live: number;
  blink: boolean;
  /** face box relative to the frame (0..1) */
  box: [number, number, number, number] | null;
}

export function readFrame(result: Result): FaceFrame {
  const face = result.face[0];
  const blink = result.gesture.some((g: any) => 'face' in g && g.face === 0 && String(g.gesture).startsWith('blink'));
  return {
    faces: result.face.length,
    faceScore: face?.faceScore ?? 0,
    descriptor: face?.embedding && face.embedding.length >= 64 ? Array.from(face.embedding) : null,
    real: face?.real ?? 0,
    live: face?.live ?? 0,
    blink,
    box: (face?.boxRaw as [number, number, number, number]) ?? null,
  };
}

/** Small JPEG thumbnail of the current video frame for the admin audit trail. */
export function captureSelfie(video: HTMLVideoElement, width = 240): string {
  const canvas = document.createElement('canvas');
  const ratio = video.videoHeight / video.videoWidth || 0.75;
  canvas.width = width;
  canvas.height = Math.round(width * ratio);
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1); // mirror like the preview
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

export interface FaceProof {
  descriptor: number[];
  liveness: number;
  antispoof: number;
  blinkDetected: boolean;
  selfie: string;
}

export interface FaceEnrollment {
  descriptors: number[][];
  photo: string;
}
