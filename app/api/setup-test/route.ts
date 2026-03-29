import { NextResponse } from "next/server";
import { runSetupTest } from "@/lib/services/products-service";

export async function POST() {
  const result = await runSetupTest();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
