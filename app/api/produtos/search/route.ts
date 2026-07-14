import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const categoriaId = req.nextUrl.searchParams.get("categoria_id");
  const supermercadoId = req.nextUrl.searchParams.get("supermercado_id");
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "15")));
  const from = (page - 1) * limit;
  const to = from + limit;

  try {
    const supabase = getSupabaseServerClient();

    if ((!q || q.length < 2) && categoriaId) {
      let query = supabase
        .from("produtos")
        .select("*, precos!inner(preco, supermercado_id, data_coleta)")
        .eq("categoria_id", parseInt(categoriaId))
        .eq("ativo", true);

      if (supermercadoId) {
        query = query.eq("precos.supermercado_id", parseInt(supermercadoId));
      }

      const { data, error } = await query.order("created_at", { ascending: false }).range(from, to);

      if (error) throw error;

      const items = data ?? [];
      const temMais = items.length > limit;
      const produtos = temMais ? items.slice(0, limit) : items;

      return NextResponse.json({ data: produtos, temMais, page, limit });
    }

    if (q && q.length >= 2) {
      // --- Fast path: tsvector (10x mais rápido que ILIKE) ---
      let produtos: any[] | null = null;
      let err1: any = null;

      // Tenta buscar via tsvector RPC primeiro
      // Se a migration não foi aplicada, o RPC não existe → fallback pra ILIKE
      ({ data: produtos, error: err1 } = await supabase.rpc("buscar_produtos_tsvector", {
        p_query: q,
        p_limit: limit + 1,
        p_categoria_id: categoriaId ? parseInt(categoriaId) : null,
      }));

      // Se tsvector falhou ou retornou vazio, fallback pra ILIKE
      if (err1 || !produtos || produtos.length === 0) {
        const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        const qNormal = normalizar(q);
        const tokens = qNormal.split(/\s+/).filter(t => t.length >= 2);

        let queryProd = supabase
          .from("produtos")
          .select("id, nome, marca, peso_volume, imagem_url, categoria_id")
          .eq("ativo", true);

        if (tokens.length === 0) {
          ({ data: produtos, error: err1 } = await queryProd
            .or(`nome.ilike.*${qNormal}*,nome.ilike.${qNormal}*`)
            .limit(limit + 1));
        } else {
          let q2 = queryProd;
          for (const token of tokens) q2 = q2.ilike("nome", `*${token}*`);
          ({ data: produtos, error: err1 } = await q2.limit(limit + 1));

          if ((!produtos || produtos.length === 0) && tokens.length > 2) {
            const contentTokens = tokens.filter(t => !/^[\d]+/.test(t) && t.length >= 3);
            if (contentTokens.length >= 2) {
              q2 = queryProd;
              for (const t of contentTokens) q2 = q2.ilike("nome", `*${t}*`);
              ({ data: produtos, error: err1 } = await q2.limit(limit + 1));
            }
          }

          if ((!produtos || produtos.length === 0) && tokens.length > 1) {
            const orTokens = tokens
              .filter(t => !/^[\d]+$/.test(t) && t.length >= 3)
              .slice(0, 5)
              .map(t => `nome.ilike.*${t}*`);
            if (orTokens.length > 0) {
              ({ data: produtos, error: err1 } = await queryProd
                .or(orTokens.join(','))
                .limit(limit + 1));
            }
          }
        }
      }

      if (err1) throw err1;

      if (!produtos || produtos.length === 0) {
        return NextResponse.json({ data: [], temMais: false, page, limit });
      }

      const ids = produtos.map(p => p.id);
      const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: precos, error: err2 }, { data: cats, error: err3 }] = await Promise.all([
        supabase
          .from("precos")
          .select("produto_id, preco, supermercado_id, data_coleta")
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
      const precoPorProduto = new Map<number, { preco: number; supermercado_id: number; data_coleta: string }[]>();
      const precoMinMap = new Map<number, number>();
      for (const p of precos ?? []) {
        const lista = precoPorProduto.get(p.produto_id) ?? [];
        lista.push({ preco: p.preco, supermercado_id: p.supermercado_id, data_coleta: p.data_coleta });
        precoPorProduto.set(p.produto_id, lista);
        const atual = precoMinMap.get(p.produto_id);
        if (atual === undefined || p.preco < atual) {
          precoMinMap.set(p.produto_id, p.preco);
        }
      }

      // Filtra por mercado quando especificado
      let idsFiltrados = ids;
      if (supermercadoId) {
        const smId = parseInt(supermercadoId);
        idsFiltrados = ids.filter(id => {
          const precosProd = precoPorProduto.get(id);
          return precosProd?.some(p => p.supermercado_id === smId);
        });
        if (idsFiltrados.length === 0) {
          return NextResponse.json({ data: [], temMais: false, page, limit });
        }
      }

      const data = produtos
        .filter(p => idsFiltrados.includes(p.id))
        .map(p => ({
        id: p.id,
        nome: p.nome,
        marca: p.marca,
        peso_volume: p.peso_volume,
        imagem_url: p.imagem_url,
        categoria_id: p.categoria_id,
        categoria_nome: catMap.get(p.categoria_id) ?? null,
        preco_minimo: precoMinMap.get(p.id) ?? null,
        precos: precoPorProduto.get(p.id) ?? [],
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
