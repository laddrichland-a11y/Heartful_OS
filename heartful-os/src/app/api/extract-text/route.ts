import { NextRequest, NextResponse } from "next/server";
import { authorizationResponse, requireClientAccess } from "@/lib/serverAuth";

// Pulls the readable text out of an uploaded transcript/notes file so it can
// be added to the notes box — and therefore saved to the client record and
// sent to the AI. Before this, PDF and Word uploads only passed the file's
// NAME along ("content extraction simulated for demo").
export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const clientId = String(form.get("clientId") ?? "");
    const file = form.get("file");
    if (!clientId || !(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }
    await requireClientAccess(clientId);
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "That file is too large (15 MB max)." }, { status: 413 });
    }

    const name = file.name.toLowerCase();
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text = "";

    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      const result = await extractText(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
    } else if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      text = result.value;
    } else if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".vtt") || name.endsWith(".srt") || file.type.startsWith("text/")) {
      text = new TextDecoder().decode(bytes);
    } else if (name.endsWith(".doc")) {
      return NextResponse.json(
        { error: "Old-style .doc files can't be read. In Word, choose File → Save As → .docx, then upload that." },
        { status: 415 },
      );
    } else {
      return NextResponse.json({ error: "Upload a .txt, .pdf or .docx file." }, { status: 415 });
    }

    text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) {
      return NextResponse.json(
        { error: "No text was found in that file. If it's a scanned PDF (a picture of pages), paste the text instead." },
        { status: 422 },
      );
    }
    return NextResponse.json({ text, fileName: file.name });
  } catch (error) {
    const authResponse = authorizationResponse(error);
    if (authResponse) return authResponse;
    console.error("Text extraction failed:", error);
    return NextResponse.json({ error: "That file couldn't be read. Try saving it as PDF or .docx again, or paste the text." }, { status: 500 });
  }
}
