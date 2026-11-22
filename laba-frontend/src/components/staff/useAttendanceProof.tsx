'use client';

import React, { useCallback, useRef, useState } from 'react';
import { FaceCapture } from '@/components/face/FaceCapture';
import { FaceProof } from '@/lib/face';
import { getCurrentFix, GpsFix } from '@/lib/location';

export type ProofStep = 'idle' | 'gps' | 'face' | 'sending';

/**
 * Collects the proof for an attendance action: a fresh GPS fix, then (if required) a live face capture.
 * Render `faceModal` somewhere in the tree.
 */
export function useAttendanceProof() {
  const [step, setStep] = useState<ProofStep>('idle');
  const [faceTitle, setFaceTitle] = useState<string | null>(null);
  const pending = useRef<{ resolve: (p: FaceProof) => void; reject: (e: Error) => void } | null>(null);

  const captureFace = (title: string) =>
    new Promise<FaceProof>((resolve, reject) => {
      pending.current = { resolve, reject };
      setFaceTitle(title);
    });

  const collect = useCallback(
    async (opts: { face: boolean; faceTitle: string }): Promise<GpsFix & { face?: FaceProof }> => {
      setStep('gps');
      const gps = await getCurrentFix();
      if (!opts.face) return gps;
      setStep('face');
      const face = await captureFace(opts.faceTitle);
      return { ...gps, face };
    },
    []
  );

  const faceModal = faceTitle ? (
    <FaceCapture
      mode="verify"
      title={faceTitle}
      onVerified={(proof) => {
        setFaceTitle(null);
        pending.current?.resolve(proof);
        pending.current = null;
      }}
      onClose={() => {
        setFaceTitle(null);
        pending.current?.reject(new Error('Face check cancelled.'));
        pending.current = null;
      }}
    />
  ) : null;

  return { step, setStep, collect, faceModal };
}

export const stepLabel: Record<ProofStep, string> = {
  idle: '',
  gps: 'Getting your GPS location…',
  face: 'Verifying your face…',
  sending: 'Submitting…',
};
