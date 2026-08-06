import { NextRequest } from "next/server";
import { proxyBulkDelete } from "@/lib/proxyBulkDelete";

export async function POST(request: NextRequest) {
  return proxyBulkDelete(request, "leads");
}
