import { NextRequest, NextResponse } from "next/server";
import { getClient, search } from "@/lib/data";
import { authorizationResponse, requirePractitioner } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  try {
    const practitioner = await requirePractitioner();
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const results = (await search(q)).filter((result) => {
      return result.clientId && result.clientId.length > 0;
    });
    const authorizedResults = [];
    for (const result of results) {
      const client = await getClient(result.clientId);
      if (client?.practitioner_id === practitioner.id) authorizedResults.push(result);
    }
    return NextResponse.json({ results: authorizedResults });
  } catch (error) {
    const authResponse = authorizationResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
