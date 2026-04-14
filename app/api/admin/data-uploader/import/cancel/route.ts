import { NextRequest, NextResponse } from "next/server";
import { markImportCancelled } from "../state";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const importId = typeof body?.importId === "string" ? body.importId : "";
    if (!importId) {
      return NextResponse.json({ success: false, message: "importId is required" }, { status: 400 });
    }
    markImportCancelled(importId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
