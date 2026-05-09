// app/api/migrate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { migrateProductsToSupabase, syncUpdatedPrices } from "@/lib/services/migration-service";

export async function POST(request: NextRequest) {
  try {
    const { batchSize = 100, action = "migrate" } = await request.json();
    
    if (action === "sync") {
      const result = await syncUpdatedPrices();
      return NextResponse.json({ success: true, ...result });
    }
    
    const result = await migrateProductsToSupabase(batchSize);
    return NextResponse.json({ success: true, ...result });
    
  } catch (error) {
    console.error("Erro na migração:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}