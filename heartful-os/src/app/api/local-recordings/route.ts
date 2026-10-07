import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { authorizationResponse, requirePractitioner } from "@/lib/serverAuth";
import { localRecordingsEnabled } from "@/lib/data";
import { localRecordingFilePath } from "@/lib/localRecordings";

// LOCAL DEMO ONLY — stores and plays back session recordings on the
// practitioner's own machine when the app runs with no Firebase (the local
// copy). The live site uses Firebase Cloud Storage and this route refuses.
export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".aac": "audio/aac",
  ".ogg": "audio/ogg", ".webm": "audio/webm", ".mp4": "video/mp4", ".mov": "video/quicktime",
};

async function resolve(req: NextRequest) {
  await requirePractitioner();
  if (!localRecordingsEnabled()) return { error: NextResponse.json({ error: "Not available." }, { status: 404 }) };
  const filePath = localRecordingFilePath(req.nextUrl.searchParams.get("path") ?? "");
  if (!filePath) return { error: NextResponse.json({ error: "Bad path." }, { status: 400 }) };
  return { filePath };
}

export async function PUT(req: NextRequest) {
  try {
    const r = await resolve(req);
    if (r.error) return r.error;
    await mkdir(/* turbopackIgnore: true */ path.dirname(r.filePath), { recursive: true });
    await writeFile(/* turbopackIgnore: true */ r.filePath, Buffer.from(await req.arrayBuffer()));
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return authorizationResponse(error) ?? NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const r = await resolve(req);
    if (r.error) return r.error;
    const bytes = await readFile(/* turbopackIgnore: true */ r.filePath);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": TYPES[path.extname(r.filePath).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": String(bytes.length),
      },
    });
  } catch (error) {
    return authorizationResponse(error) ?? NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }
}
