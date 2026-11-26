'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, ScanFace, Eye, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { getHuman, readFrame, captureSelfie, FaceProof, FaceEnrollment } from '@/lib/face';

type Mode = 'verify' | 'enroll';

interface Props {
  mode: Mode;
  title?: string;
  onVerified?: (proof: FaceProof) => void;
  onEnrolled?: (enrollment: FaceEnrollment) => void;
  onClose: () => void;
}

type Phase = 'loading' | 'align' | 'blink' | 'capture' | 'done' | 'error';

const SAMPLES_VERIFY = 3; // frames averaged for one verification
const SAMPLES_ENROLL = 3; // separate descriptors stored at enrolment
const TIMEOUT_MS = 40000;

export function FaceCapture({ mode, title, onVerified, onEnrolled, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [hint, setHint] = useState('Preparing face check…');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    stopRef.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const stopCamera = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    const fail = (msg: string) => {
      stopRef.current = true;
      stopCamera();
      setError(msg);
      setPhase('error');
    };

    (async () => {
      setPhase('loading');
      setError(null);
      setProgress(0);
      setHint('Loading face engine… (first time can take up to a minute)');
      let human;
      try {
        human = await getHuman();
      } catch {
        return fail('Face models could not be loaded on this device. Restart the app and try again.');
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
      } catch (e: any) {
        return fail(
          e?.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access for J-Track in your phone settings.'
            : 'Could not open the front camera.'
        );
      }

      const started = Date.now();
      let blinkSeen = false;
      const descriptors: number[][] = [];
      let realSum = 0;
      let liveSum = 0;
      let selfie = '';
      let lastSampleAt = 0;
      setPhase('align');

      const loop = async () => {
        if (stopRef.current) return;
        if (Date.now() - started > TIMEOUT_MS) {
          return fail('Face check timed out. Make sure your face is well lit and try again.');
        }
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          timer = setTimeout(loop, 150);
          return;
        }

        const frame = readFrame(await human.detect(video));
        const width = frame.box ? frame.box[2] : 0;

        if (frame.faces === 0) {
          setHint('Place your face inside the circle');
        } else if (frame.faces > 1) {
          setHint('Only one person should be in the frame');
        } else if (frame.faceScore < 0.6 || width < 0.22) {
          setHint('Move a little closer to the camera');
        } else if (!blinkSeen) {
          setPhase('blink');
          setHint('Blink your eyes slowly');
          if (frame.blink) blinkSeen = true;
        } else if (!frame.blink && frame.descriptor) {
          const gap = mode === 'enroll' ? 700 : 120;
          if (Date.now() - lastSampleAt > gap) {
            setPhase('capture');
            setHint(mode === 'enroll' ? 'Hold still… saving your face' : 'Hold still…');
            descriptors.push(frame.descriptor);
            realSum += frame.real;
            liveSum += frame.live;
            lastSampleAt = Date.now();
            if (!selfie && videoRef.current) selfie = captureSelfie(videoRef.current);
            const needed = mode === 'enroll' ? SAMPLES_ENROLL : SAMPLES_VERIFY;
            setProgress(Math.round((descriptors.length / needed) * 100));

            if (descriptors.length >= needed) {
              stopRef.current = true;
              stopCamera();
              setPhase('done');
              setHint('Done');
              if (mode === 'enroll') {
                onEnrolled?.({ descriptors, photo: selfie });
              } else {
                // average the descriptors for a steadier match
                const avg = descriptors[0].map((_, i) => descriptors.reduce((s, d) => s + d[i], 0) / descriptors.length);
                onVerified?.({
                  descriptor: avg,
                  liveness: liveSum / descriptors.length,
                  antispoof: realSum / descriptors.length,
                  blinkDetected: true,
                  selfie,
                });
              }
              return;
            }
          }
        }
        timer = setTimeout(loop, 100);
      };
      loop();
    })();

    return () => {
      stopRef.current = true;
      if (timer) clearTimeout(timer);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, mode]);

  const ring =
    phase === 'done'
      ? 'ring-emerald-400'
      : phase === 'capture'
        ? 'ring-brand-500'
        : phase === 'blink'
          ? 'ring-amber-400'
          : phase === 'error'
            ? 'ring-red-500'
            : 'ring-white/40';

  return (
    <div className="fixed inset-0 z-[100] bg-ink flex flex-col text-white">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
        <div className="flex items-center gap-2">
          <ScanFace className="w-5 h-5 text-brand-200" />
          <span className="font-semibold text-sm">{title || (mode === 'enroll' ? 'Face enrolment' : 'Face verification')}</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className={`relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden ring-4 ${ring} transition-all bg-black`}>
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover -scale-x-100" />
          {phase === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="w-8 h-8 animate-spin text-brand-200" />
            </div>
          )}
          {phase === 'done' && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/50">
              <CheckCircle2 className="w-14 h-14 text-emerald-300" />
            </div>
          )}
        </div>

        <div className="mt-8 text-center min-h-[4rem]">
          {phase === 'error' ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-start gap-2 text-red-300 text-sm max-w-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => setAttempt((a) => a + 1)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-ink text-sm font-semibold"
              >
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                {phase === 'blink' && <Eye className="w-5 h-5 text-amber-300" />}
                <span>{hint}</span>
              </div>
              {(phase === 'capture' || phase === 'done') && (
                <div className="mt-4 w-48 mx-auto h-1.5 bg-white/15 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center text-xs text-white/50">
        Good light, face the camera, no cap or mask. Your face is checked on this phone and matched by the J-Track server.
      </div>
    </div>
  );
}
