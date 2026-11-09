import {
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { AuthUser } from './auth-user.js';

export type FirebaseAdminEnv = {
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  GOOGLE_APPLICATION_CREDENTIALS?: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
};

/**
 * Verifies Firebase ID tokens for Nest routes.
 * Prefer FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY on Railway;
 * GOOGLE_APPLICATION_CREDENTIALS works for local ADC / GCP.
 */
@Injectable()
export class FirebaseAuthService implements OnModuleInit {
  private app: App | null = null;

  onModuleInit(): void {
    this.app = this.init(process.env);
  }

  /** Test helper: replace the Admin app after construction. */
  setApp(app: App | null): void {
    this.app = app;
  }

  isConfigured(): boolean {
    return this.app !== null;
  }

  init(env: FirebaseAdminEnv = process.env): App | null {
    if (getApps().length > 0) {
      return getApps()[0]!;
    }

    const projectId = env.FIREBASE_PROJECT_ID ?? env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) return null;

    const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (clientEmail && privateKey) {
      return initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      });
    }

    if (env.GOOGLE_APPLICATION_CREDENTIALS) {
      return initializeApp({
        credential: applicationDefault(),
        projectId,
      });
    }

    return null;
  }

  async verifyIdToken(idToken: string): Promise<AuthUser> {
    if (!this.app) {
      throw new ServiceUnavailableException('Auth is not configured');
    }
    try {
      const decoded = await getAuth(this.app).verifyIdToken(idToken, true);
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        emailVerified: Boolean(decoded.email_verified),
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
