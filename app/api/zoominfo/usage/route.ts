import { NextRequest } from "next/server";
import { proxyZoomInfo } from "@/lib/zoominfoProxy";

export async function GET(request: NextRequest) {
  return proxyZoomInfo(request, "usage", "GET");
}
