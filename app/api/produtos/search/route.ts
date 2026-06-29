import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const categoriaId = req.nextUrl.searchParams.get("categoria_id");
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "15")));
  const from = (page - 1) * limit;
  const to = from + limit;

  try {
    const supabase = getSupabaseServerClient();

    if ((!q || q.length < 2) && categoriaId) {
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

    if (q && q.length >= 2) {
      const { data: produtos, error: err1 } = await supabase
        .from("produtos")
        .select("id, nome, marca, peso_volume, imagem_url, categoria_id")
        .eq("ativo", true)
        .or(`nome.ilike.*${q}*,nome.ilike.${q}*`)
        .limit(limit + 1);

      if (err1) throw err1;

      if (!produtos || produtos.length === 0) {
        return NextResponse.json({ data: [], temMais: false, page, limit });
      }

      const ids = produtos.map(p => p.id);
      const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: precos, error: err2 }, { data: cats, error: err3 }] = await Promise.all([
        supabase
          .from("precos")
          .select("produto_id, preco")
          .in("produto_id", ids)
          .gte("data_coleta", trintaDias),
        supabase
          .from("categorias")
          .select("id, nome")
          .in("id", [...new Set(produtos.map(p => p.categoria_id).filter(Boolean))]),
      ]);

      if (err2) throw err2;
      if (err3) throw err3;

      const catMap = new Map(cats?.map(c => [c.id, c.nome]) ?? []);
      const precoMinMap = new Map<number, number>();
      for (const p of precos ?? []) {
        const atual = precoMinMap.get(p.produto_id);
        if (atual === undefined || p.preco < atual) {
          precoMinMap.set(p.produto_id, p.preco);
        }
      }

      const data = produtos.map(p => ({
        id: p.id,
        nome: p.nome,
        marca: p.marca,
        peso_volume: p.peso_volume,
        imagem_url: p.imagem_url,
        categoria_id: p.categoria_id,
        categoria_nome: catMap.get(p.categoria_id) ?? null,
        preco_minimo: precoMinMap.get(p.id) ?? null,
      }));

      const temMais = data.length > limit;
      const result = temMais ? data.slice(0, limit) : data;

      return NextResponse.json({ data: result, temMais, page, limit });
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
