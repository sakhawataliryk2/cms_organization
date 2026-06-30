import { NextRequest } from "next/server";
import { proxyBulkArchive } from "@/lib/proxyBulkArchive";

export async function POST(request: NextRequest) {
  return proxyBulkArchive(request, "leads");
}
