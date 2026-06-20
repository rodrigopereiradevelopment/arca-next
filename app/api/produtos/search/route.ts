import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  const categoriaId = req.nextUrl.searchParams.get("categoria_id");
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "15")));
  const from = (page - 1) * limit;
  const to = from + limit;

  try {
    const supabase = getSupabaseServerClient();

    // Busca por categoria (sem texto)
    if ((!query || query.length < 2) && categoriaId) {
      const { data, error } = await supabase
        .from("produtos")
        .select("*, precos!inner(preco, supermercado_id, data_coleta)")
        .eq("categoria_id", parseInt(categoriaId))
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const items = data ?? [];
      const temMais = items.length > limit;
      const produtos = temMais ? items.slice(0, limit) : items;

      return NextResponse.json({ data: produtos, temMais, page, limit });
    }

    // Busca por texto via RPC (trigram + substring)
    if (query && query.length >= 2) {
      const { data, error } = await supabase
        .rpc('buscar_produtos', { p_termo: query, p_limite: limit + 1 });

      if (error) throw error;

      const items = data ?? [];
      const temMais = items.length > limit;
      const produtos = temMais ? items.slice(0, limit) : items;

      return NextResponse.json({ data: produtos, temMais, page, limit });
    }

    return NextResponse.json({ data: [], temMais: false, page: 1, limit: 0 });
  } catch (error) {
    console.error("SEARCH ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro na busca" },
      { status: 500 }
    );
  }
}
