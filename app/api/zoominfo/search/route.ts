import { NextRequest } from "next/server";
import { proxyZoomInfo } from "@/lib/zoominfoProxy";

export async function POST(request: NextRequest) {
  return proxyZoomInfo(request, "search", "POST");
}
