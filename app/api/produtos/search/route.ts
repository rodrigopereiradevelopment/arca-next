import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .rpc('buscar_produtos', { termo: query.toLowerCase() });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("SEARCH ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro na busca" },
      { status: 500 }
    );
  }
}
