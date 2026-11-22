import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { bestFaceSimilarity, faceSimilarity, FACE_MODEL_VERSION, isValidDescriptor, Descriptor } from '../utils/faceMatch';
import { FaceProof } from '../schemas/proof.schema';
import { APP_CONSTANTS } from '../config/constants';

export interface EnrollInput {
  descriptors: number[][];
  photo: string;
  consent: boolean;
}

export class FaceService {
  async getStatus(employeeId: string) {
    const profile = await prisma.faceProfile.findUnique({
      where: { employeeId },
      select: { id: true, createdAt: true, modelVersion: true },
    });
    return { enrolled: !!profile, enrolledAt: profile?.createdAt ?? null, modelVersion: profile?.modelVersion ?? null };
  }

  /**
   * Enrols the employee's face. Re-enrolment is blocked until an admin resets it,
   * so a staff member cannot swap in another person's face later.
   */
  async enroll(userId: string, employeeId: string, organizationId: string, input: EnrollInput) {
    if (!input.consent) {
      throw new AppError('Consent is required to store your face data for attendance verification.', 400, 'FACE_CONSENT_REQUIRED');
    }
    if (!Array.isArray(input.descriptors) || input.descriptors.length < 2 || input.descriptors.length > 5) {
      throw new AppError('Provide between 2 and 5 face samples.', 400, 'FACE_SAMPLES_INVALID');
    }
    if (!input.descriptors.every(isValidDescriptor)) {
      throw new AppError('Face samples are invalid. Please retry the capture.', 400, 'FACE_SAMPLES_INVALID');
    }
    // All enrolment samples must be the same person
    const [first, ...rest] = input.descriptors as Descriptor[];
    for (const sample of rest) {
      if (faceSimilarity(first, sample) < APP_CONSTANTS.FACE_ENROLL_CONSISTENCY) {
        throw new AppError(
          'The face samples do not look like the same person. Retake the photos in good light, facing the camera.',
          400,
          'FACE_SAMPLES_INCONSISTENT'
        );
      }
    }

    const existing = await prisma.faceProfile.findUnique({ where: { employeeId } });
    if (existing) {
      throw new AppError('Your face is already enrolled. Ask your admin to reset it if you need to re-enrol.', 409, 'FACE_ALREADY_ENROLLED');
    }

    const profile = await prisma.faceProfile.create({
      data: {
        employeeId,
        embeddings: input.descriptors,
        photo: input.photo,
        modelVersion: FACE_MODEL_VERSION,
        consentAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        actorId: userId,
        actorRole: 'EMPLOYEE',
        action: 'FACE_ENROLLED',
        entityType: 'face_profiles',
        entityId: profile.id,
        metadata: { samples: input.descriptors.length },
      },
    });

    return { enrolled: true, enrolledAt: profile.createdAt };
  }

  /** Admin: remove a face profile so the employee must enrol again. */
  async reset(adminUserId: string, organizationId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
    if (!employee) throw new AppError('Employee not found.', 404, 'NOT_FOUND');
    await prisma.faceProfile.deleteMany({ where: { employeeId } });
    await prisma.auditLog.create({
      data: {
        organizationId,
        actorId: adminUserId,
        actorRole: 'ADMIN',
        action: 'FACE_RESET',
        entityType: 'employees',
        entityId: employeeId,
      },
    });
    return { reset: true };
  }

  async getPhoto(organizationId: string, employeeId: string) {
    const profile = await prisma.faceProfile.findFirst({
      where: { employeeId, employee: { organizationId } },
      select: { photo: true, createdAt: true },
    });
    if (!profile) throw new AppError('No face enrolled for this employee.', 404, 'FACE_NOT_ENROLLED');
    return profile;
  }

  /**
   * Verifies a live face capture against the enrolled profile.
   * Returns the similarity score; throws if verification fails.
   */
  async verify(employeeId: string, proof: FaceProof | undefined, threshold: number): Promise<number> {
    if (!proof) {
      throw new AppError('Face verification is required. Please capture your face.', 400, 'FACE_REQUIRED');
    }
    const profile = await prisma.faceProfile.findUnique({ where: { employeeId } });
    if (!profile) {
      throw new AppError('Your face is not enrolled yet. Complete face enrolment first.', 403, 'FACE_NOT_ENROLLED');
    }
    if (!proof.blinkDetected) {
      throw new AppError('Liveness check failed: please blink when the camera asks you to.', 400, 'FACE_LIVENESS_FAILED');
    }
    if (proof.liveness < APP_CONSTANTS.FACE_MIN_LIVENESS || proof.antispoof < APP_CONSTANTS.FACE_MIN_ANTISPOOF) {
      throw new AppError(
        'Liveness check failed. Use your real face (not a photo or screen) in good light.',
        400,
        'FACE_LIVENESS_FAILED'
      );
    }

    const enrolled = (profile.embeddings as unknown as Descriptor[]) || [];
    const score = bestFaceSimilarity(proof.descriptor, enrolled);
    if (score < threshold) {
      throw new AppError(
        `Face did not match the enrolled profile (match ${Math.round(score * 100)}%, needs ${Math.round(threshold * 100)}%). Try again facing the camera in good light.`,
        400,
        'FACE_MISMATCH'
      );
    }
    return score;
  }
}

export const faceService = new FaceService();
