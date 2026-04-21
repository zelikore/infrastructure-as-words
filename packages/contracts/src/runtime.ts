import { z } from "zod";

export const webRuntimeConfigSchema = z.object({
  environmentName: z.enum(["dev", "prod"]),
  appOrigin: z.url(),
  apiBaseUrl: z.url(),
  authDomain: z.string().min(1),
  authIssuer: z.url(),
  userPoolClientId: z.string().min(1),
  oauthScopes: z.array(z.string().min(1)).min(1),
  redirectUri: z.url(),
  logoutUri: z.url()
});

export const browserSessionSchema = z.object({
  accessToken: z.string().min(1),
  idToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.iso.datetime(),
  profile: z.object({
    sub: z.string().min(1),
    email: z.email().optional(),
    name: z.string().min(1).optional()
  })
});

export type WebRuntimeConfig = z.infer<typeof webRuntimeConfigSchema>;
export type BrowserSession = z.infer<typeof browserSessionSchema>;

