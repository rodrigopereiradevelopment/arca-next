import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

interface ProdutoItem {
  id?: number;
  nome: string;
  quantidade: number;
}

export async function POST(req: NextRequest) {
  try {
    const { produtos } = await req.json() as { produtos: ProdutoItem[] };
    if (!produtos || produtos.length === 0) {
      return NextResponse.json({ sucesso: false, erro: "Nenhum produto enviado" }, { status: 400, headers: CORS_HEADERS });
    }

    const MAX_PRODUTOS = 10;
    if (produtos.length > MAX_PRODUTOS) {
      return NextResponse.json(
        { sucesso: false, erro: `Máximo de ${MAX_PRODUTOS} produtos por comparação. Você enviou ${produtos.length}.` },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const supabase = getSupabaseServerClient();

    // Buscar todos os mercados (incluindo pendentes para demo/TCC)
    const { data: mercados } = await supabase.from("supermercados")
      .select("id, nome").order("id");
    if (!mercados || mercados.length === 0) {
      return NextResponse.json({ sucesso: false, erro: "Nenhum mercado cadastrado" }, { status: 404, headers: CORS_HEADERS });
    }

    // ── 1. Resolver produtos (sequential ILIKE por nome + batch por ID) ─
    const nomesUnicos = [...new Set(
      produtos.filter(p => !p.id).map(p => p.nome.trim().toUpperCase())
    )];

    const idsDiretos = produtos.filter(p => p.id).map(p => p.id!);
    const resolvedMap: Record<string, { id: number; nome: string; categoria_id: number | null; peso_volume: string | null }> = {};

    // Buscar por IDs diretos (batch)
    if (idsDiretos.length > 0) {
      const { data: porId } = await supabase.from("produtos")
        .select("id, nome, categoria_id, peso_volume")
        .in("id", idsDiretos);
      if (porId) for (const p of porId) resolvedMap[String(p.id)] = p;
    }

    // Buscar por nome (frase inteira com ILIKE + índice GIN)
    if (nomesUnicos.length > 0) {
      const resultados = await Promise.all(
        nomesUnicos.map(async (nome) => {
          const { data } = await supabase
            .from("produtos")
            .select("id, nome, categoria_id, peso_volume")
            .ilike("nome", `%${nome}%`)
            .limit(1);
          return { nome, produto: data?.[0] || null };
        })
      );
      for (const { nome, produto } of resultados) {
        if (produto) resolvedMap[nome] = produto;
      }
    }

    // ── 2. Buscar todos os preços de uma vez ──────────────────────────
    const allIds = new Set<number>();
    for (const p of produtos) {
      if (p.id && resolvedMap[String(p.id)]) allIds.add(p.id);
    }
    for (const v of Object.values(resolvedMap)) allIds.add(v.id);

    const diasLimite = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const priceMap: Record<string, number> = {};
    const dateMap: Record<string, string> = {};

    if (allIds.size > 0) {
      const { data: precos } = await supabase
        .from("precos")
        .select("produto_id, supermercado_id, preco, data_coleta")
        .in("produto_id", [...allIds])
        .gte("data_coleta", diasLimite);

      if (precos) {
        for (const p of precos) {
          const key = `${p.produto_id}_${p.supermercado_id}`;
          if (!dateMap[key] || p.data_coleta > dateMap[key]) {
            priceMap[key] = p.preco;
            dateMap[key] = p.data_coleta;
          }
        }
      }
    }

    // ── 3. Função auxiliar: resolver ID de um produto ─────────────────
    function resolveId(produto: ProdutoItem): { id: number; nome: string; categoria_id: number | null; peso_volume: string | null } | null {
      if (produto.id) {
        const found = resolvedMap[String(produto.id)];
        return found || null;
      }
      const termo = produto.nome.trim().toUpperCase();
      // Busca direta primeiro
      for (const v of Object.values(resolvedMap)) {
        if (v.nome?.toUpperCase() === termo) return v;
      }
      // Busca parcial
      for (const v of Object.values(resolvedMap)) {
        if (v.nome?.toUpperCase().includes(termo) || termo.includes(v.nome?.toUpperCase() || '')) return v;
      }
      return null;
    }

    // ── 4. Construir matriz de comparação ─────────────────────────────
    interface MercadoAcc {
      total: number;
      itens: number;
      produtos: any[];
    }

    // 4a. Primeira passada: preços exatos + coletar produtos que precisam fallback
    const acc: Record<number, MercadoAcc> = {};
    for (const m of mercados) acc[m.id] = { total: 0, itens: 0, produtos: [] };

    const produtosResolvidos: { produto: ProdutoItem; resolved: { id: number; nome: string; categoria_id: number | null } }[] = [];

    for (const produto of produtos) {
      const quantidade = produto.quantidade || 1;
      const resolved = resolveId(produto);
      if (!resolved) {
        for (const m of mercados) {
          acc[m.id].produtos.push({
            nome: produto.nome, nomeEncontrado: null, tipoBusca: null,
            quantidade, precoUnitario: 0, subtotal: 0, naoEncontrado: true,
          });
        }
        continue;
      }
      produtosResolvidos.push({ produto, resolved });

      for (const mercado of mercados) {
        const preco = priceMap[`${resolved.id}_${mercado.id}`];
        if (preco !== undefined && preco > 0) {
          acc[mercado.id].total += preco * quantidade;
          acc[mercado.id].itens++;
          acc[mercado.id].produtos.push({
            nome: produto.nome, nomeEncontrado: resolved.nome,
            tipoBusca: produto.id ? 'id' : 'nome',
            quantidade, precoUnitario: preco, subtotal: preco * quantidade,
            naoEncontrado: false,
          });
        }
      }

      // Placeholder para mercados sem preço (sempre — garante N entradas/mercado)
      for (const mercado of mercados) {
        const preco = priceMap[`${resolved.id}_${mercado.id}`];
        if (!preco || preco <= 0) {
          acc[mercado.id].produtos.push({
            nome: produto.nome, nomeEncontrado: null, tipoBusca: null,
            quantidade, precoUnitario: 0, subtotal: 0, naoEncontrado: true,
          });
        }
      }
    }

    // 4b. Fallback: buscar equivalentes via tabela pré-computada
    //     produtos_equivalentes pré-populada com trigram + marca + categoria
    const fallbacks = produtosResolvidos.filter(({ resolved }) => {
      for (const m of mercados) {
        const preco = priceMap[`${resolved.id}_${m.id}`];
        if (!preco || preco <= 0) return true;
      }
      return false;
    });

    if (fallbacks.length > 0) {
      const fallbackIds = fallbacks.map(f => f.resolved.id);

      // Tenta produtos_equivalentes primeiro (rápido, tabela pré-computada)
      const [eqResA, eqResB] = await Promise.all([
        supabase.from("produtos_equivalentes").select("produto_id_a, produto_id_b, score").in("produto_id_a", fallbackIds).gte("score", 0.3).order("score", { ascending: false }),
        supabase.from("produtos_equivalentes").select("produto_id_a, produto_id_b, score").in("produto_id_b", fallbackIds).gte("score", 0.3).order("score", { ascending: false }),
      ]);
      const equivalentes = [...(eqResA.data || []), ...(eqResB.data || [])]
        .sort((a, b) => (b.score || 0) - (a.score || 0));

      const resultados: { produtoId: number; nomeOriginal: string; similares: { id: number; nome: string }[] }[] = [];
      const similarIds = new Set<number>();
      const fallbackIdsComMatch = new Set<number>();

      if (equivalentes) {
        for (const fbId of fallbackIds) {
          const matchIds = new Set<number>();
          for (const e of equivalentes) {
            if (e.produto_id_a === fbId) matchIds.add(e.produto_id_b);
            if (e.produto_id_b === fbId) matchIds.add(e.produto_id_a);
          }
          if (matchIds.size > 0) {
            fallbackIdsComMatch.add(fbId);
            for (const id of matchIds) similarIds.add(id);
            resultados.push({
              produtoId: fbId,
              nomeOriginal: fallbacks.find(f => f.resolved.id === fbId)?.resolved.nome || '',
              similares: [...matchIds].map(id => ({ id, nome: '' })),
            });
          }
        }
      }

      // Fallback ILIKE para produtos sem match na tabela (mais abrangente)
      const semMatch = fallbacks.filter(f => !fallbackIdsComMatch.has(f.resolved.id));
      if (semMatch.length > 0) {
        const ilikeResults = await Promise.all(
          semMatch.map(async ({ produto, resolved }) => {
            const termo = (produto.nome || resolved.nome).trim().toUpperCase();
            const palavras = termo.split(/\s+/).filter(p => p.length >= 2).slice(0, 4);

            let query = supabase.from("produtos").select("id, nome")
              .neq("id", resolved.id);
            if (resolved.categoria_id) query = query.eq("categoria_id", resolved.categoria_id);
            for (const p of palavras) query = query.ilike("nome", `%${p}%`);

            const { data } = await query.limit(5);
            return { produtoId: resolved.id, nomeOriginal: resolved.nome, similares: (data ?? []).map(s => ({ id: s.id, nome: s.nome })) };
          })
        );
        for (const r of ilikeResults) {
          if (r.similares.length > 0) {
            resultados.push(r);
            for (const s of r.similares) similarIds.add(s.id);
          }
        }
      }

      // Buscar nomes dos equivalentes (se ainda não foram preenchidos pelo ILIKE)
      if (similarIds.size > 0) {
        const { data: nomes } = await supabase
          .from("produtos")
          .select("id, nome")
          .in("id", [...similarIds]);
        if (nomes) {
          const nomeMap = new Map(nomes.map(n => [n.id, n.nome]));
          for (const r of resultados) {
            for (const s of r.similares) {
              if (!s.nome) s.nome = nomeMap.get(s.id) || '';
            }
          }
        }
      }

      // Buscar preços dos equivalentes no mesmo período
      let precosSimilares: any[] = [];
      if (similarIds.size > 0) {
        const { data } = await supabase
          .from("precos")
          .select("produto_id, supermercado_id, preco")
          .in("produto_id", [...similarIds])
          .gte("data_coleta", diasLimite);
        if (data) precosSimilares = data;
      }

      // Indexar preços similares por produto + mercado
      const similarPriceMap: Record<string, number> = {};
      for (const p of precosSimilares) {
        const key = `${p.produto_id}_${p.supermercado_id}`;
        if (similarPriceMap[key] === undefined || p.preco < similarPriceMap[key]) {
          similarPriceMap[key] = p.preco;
        }
      }

      // Segunda passada: preencher fallbacks nos mercados faltantes
      for (const r of resultados) {
        for (const mercado of mercados) {
          const jaTem = acc[mercado.id].produtos.some(
            (p: any) => p.nome === fallbacks.find(f => f.resolved.id === r.produtoId)?.produto.nome && !p.naoEncontrado
          );
          if (jaTem) continue;

          let encontrado = false;
          for (const s of r.similares) {
            const preco = similarPriceMap[`${s.id}_${mercado.id}`];
            if (preco && preco > 0) {
              encontrado = true;
              acc[mercado.id].total += preco * (fallbacks.find(f => f.resolved.id === r.produtoId)?.produto.quantidade || 1);
              acc[mercado.id].itens++;
              const placeholderIdx = acc[mercado.id].produtos.findLastIndex(
                (p: any) => p.naoEncontrado && p.nome === (fallbacks.find(f => f.resolved.id === r.produtoId)?.produto.nome)
              );
              if (placeholderIdx >= 0) {
                acc[mercado.id].produtos[placeholderIdx] = {
                  nome: fallbacks.find(f => f.resolved.id === r.produtoId)?.produto.nome,
                  nomeEncontrado: s.nome,
                  tipoBusca: 'similar',
                  similarInfo: { nomeOriginal: r.nomeOriginal },
                  quantidade: fallbacks.find(f => f.resolved.id === r.produtoId)?.produto.quantidade || 1,
                  precoUnitario: preco,
                  subtotal: preco * (fallbacks.find(f => f.resolved.id === r.produtoId)?.produto.quantidade || 1),
                  naoEncontrado: false,
                };
              }
              break;
            }
          }
        }
      }
    }

    // ── 5. Montar resposta ────────────────────────────────────────────
    const resposta = mercados.map((m) => ({
      id: m.id,
      nome: m.nome,
      total: Math.round(acc[m.id].total * 100) / 100,
      itensEncontrados: acc[m.id].itens,
      totalProdutos: produtos.length,
      produtos: acc[m.id].produtos,
    }));

    resposta.sort((a, b) => {
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return a.total - b.total;
    });

    return NextResponse.json({
      sucesso: true,
      mercados: resposta,
      totalProdutos: produtos.length,
    }, { headers: CORS_HEADERS });

  } catch (error) {
    console.error("Erro no comparador:", error);
    return NextResponse.json(
      { sucesso: false, erro: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
