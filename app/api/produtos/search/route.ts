import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.toLowerCase().trim();

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const supabase = getSupabaseServerClient();


    const { data, error } = await supabase
    .from("produtos")
    .select(`
        id,
        nome,
        imagem_url,
        tipo,
        categoria_id,
        codigo_barras,
        precos (
        preco,
        data_coleta,
        supermercado_id
        )
    `)
    .ilike("nome", `%${query}%`)
    .limit(30);

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("SEARCH ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}