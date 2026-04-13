import { NextResponse } from "next/server";
import { getCoinGeckoPairs } from "@/lib/api/coingecko";

export async function GET() {
  try {
    const pairs = await getCoinGeckoPairs();
    return NextResponse.json({ pairs });
  } catch (error) {
    console.error("Failed to fetch pairs:", error);
    return NextResponse.json({ pairs: [], error: "Failed to fetch pairs" }, { status: 500 });
  }
}
