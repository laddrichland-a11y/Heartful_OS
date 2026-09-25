import "server-only";

import { cookies } from "next/headers";
import * as data from "@/lib/data";
import type { Client, Profile, Prospect } from "@/lib/types";

const AUTH_COOKIE = "heartful_auth";
const PORTAL_UNLOCK_PREFIX = "portal_unlock_";

export class AuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function getAuthenticatedPractitioner(): Promise<Profile | null> {
  const expected = process.env.PRACTITIONER_PASSWORD;
  if (!expected) return null;
  const cookie = (await cookies()).get(AUTH_COOKIE)?.value;
  if (cookie !== expected) return null;
  return data.getPractitioner();
}

export async function requirePractitioner(): Promise<Profile> {
  const practitioner = await getAuthenticatedPractitioner();
  if (!practitioner) throw new AuthorizationError(401, "Authentication required.");
  return practitioner;
}

async function hasAnyPortalSession(): Promise<boolean> {
  return (await cookies()).getAll().some((cookie) => cookie.name.startsWith(PORTAL_UNLOCK_PREFIX));
}

export async function isPortalSessionForClient(client: Client): Promise<boolean> {
  if (!client.portal_password_hash) return false;
  const cookie = (await cookies()).get(`${PORTAL_UNLOCK_PREFIX}${client.id}`)?.value;
  return cookie === client.portal_password_hash;
}

export type ClientActor =
  | { kind: "practitioner"; practitioner: Profile; client: Client }
  | { kind: "portal"; client: Client };

export async function requireClientAccess(
  clientId: string,
  options: { allowPortal?: boolean } = {},
): Promise<ClientActor> {
  const practitioner = await getAuthenticatedPractitioner();
  const client = await data.getClient(clientId);

  if (practitioner) {
    if (!client || client.practitioner_id !== practitioner.id) {
      throw new AuthorizationError(403, "You are not authorized to access this client.");
    }
    return { kind: "practitioner", practitioner, client };
  }

  if (options.allowPortal && client && await isPortalSessionForClient(client)) {
    return { kind: "portal", client };
  }

  if (options.allowPortal && await hasAnyPortalSession()) {
    throw new AuthorizationError(403, "This portal session does not belong to that client.");
  }

  throw new AuthorizationError(401, "Authentication required.");
}

export async function requireProspectAccess(prospectId: string): Promise<Prospect> {
  const practitioner = await requirePractitioner();
  const prospect = await data.getProspect(prospectId);
  if (!prospect || prospect.practitioner_id !== practitioner.id) {
    throw new AuthorizationError(403, "You are not authorized to access this prospect.");
  }
  return prospect;
}

export function authorizationResponse(error: unknown): Response | null {
  if (!(error instanceof AuthorizationError)) return null;
  return Response.json({ error: error.message }, { status: error.status });
}
