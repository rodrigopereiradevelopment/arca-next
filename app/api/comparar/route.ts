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

    // ── 1. Resolver todos os produtos de uma vez via RPC em lote ─────────
    const nomesUnicos = [...new Set(
      produtos.filter(p => !p.id).map(p => p.nome.trim().toUpperCase())
    )];

    const idsDiretos = produtos.filter(p => p.id).map(p => p.id!);
    const resolvedMap: Record<string, { id: number; nome: string; categoria_id: number | null; peso_volume: string | null }> = {};

    // Buscar por IDs diretos (mantém batch)
    if (idsDiretos.length > 0) {
      const { data: porId } = await supabase.from("produtos")
        .select("id, nome, categoria_id, peso_volume")
        .in("id", idsDiretos);
      if (porId) for (const p of porId) resolvedMap[String(p.id)] = p;
    }

    // Buscar por nome via RPC em lote (uma query só)
    if (nomesUnicos.length > 0) {
      const { data: resolvidos, error } = await supabase.rpc('resolver_produtos', {
        p_nomes: nomesUnicos,
      });

      if (error) {
        console.error('Erro na resolução em lote:', error);
      } else if (resolvidos) {
        for (const r of resolvidos) {
          if (r.termo_original && r.produto_id) {
            resolvedMap[r.termo_original] = {
              id: r.produto_id,
              nome: r.nome_produto,
              categoria_id: r.categoria_id,
              peso_volume: r.peso_volume,
            };
          }
        }
      }
    }

    // ── 2. Buscar todos os preços de uma vez ──────────────────────────
    const allIds = new Set<number>();
    for (const p of produtos) {
      if (p.id && resolvedMap[String(p.id)]) allIds.add(p.id);
    }
    for (const v of Object.values(resolvedMap)) allIds.add(v.id);

    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const priceMap: Record<string, number> = {};
    const dateMap: Record<string, string> = {};

    if (allIds.size > 0) {
      const { data: precos } = await supabase
        .from("precos")
        .select("produto_id, supermercado_id, preco, data_coleta")
        .in("produto_id", [...allIds])
        .gte("data_coleta", trintaDiasAtras);

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
    const acc: Record<number, MercadoAcc> = {};
    for (const m of mercados) acc[m.id] = { total: 0, itens: 0, produtos: [] };

    // Pré-computar preço médio de referência para cada produto
    const precoMedioRef: Record<number, number> = {};
    for (const id of allIds) {
      const precosProduto = Object.entries(priceMap)
        .filter(([k]) => k.startsWith(`${id}_`))
        .map(([, v]) => v);
      if (precosProduto.length > 0) {
        precoMedioRef[id] = precosProduto.reduce((a, b) => a + b, 0) / precosProduto.length;
      }
    }

    for (const produto of produtos) {
      const quantidade = produto.quantidade || 1;
      const resolved = resolveId(produto);

      for (const mercado of mercados) {
        if (!resolved) {
          acc[mercado.id].produtos.push({
            nome: produto.nome, nomeEncontrado: null, tipoBusca: null,
            quantidade, precoUnitario: 0, subtotal: 0, naoEncontrado: true,
          });
          continue;
        }

        const preco = priceMap[`${resolved.id}_${mercado.id}`];

        if (preco !== undefined && preco > 0) {
          // Produto exato encontrado
          acc[mercado.id].total += preco * quantidade;
          acc[mercado.id].itens++;
          acc[mercado.id].produtos.push({
            nome: produto.nome, nomeEncontrado: resolved.nome,
            tipoBusca: produto.id ? 'id' : 'nome',
            quantidade, precoUnitario: preco, subtotal: preco * quantidade,
            naoEncontrado: false,
          });
        } else {
          // ── Fallback: buscar similar via Fase 1 (trigram) ────────
          try {
            const { data: similares } = await supabase.rpc('buscar_produtos_similares', {
              p_nome: produto.nome,
              p_categoria_id: resolved.categoria_id,
              p_peso: resolved.peso_volume,
              p_preco_ref: precoMedioRef[resolved.id] || null,
              p_mercado_id: mercado.id,
              p_produto_id: resolved.id,
              p_limite: 1,
            });

            if (similares && similares.length > 0 && similares[0].score_relevancia >= 0.75) {
              const s = similares[0];
              acc[mercado.id].total += s.preco * quantidade;
              acc[mercado.id].itens++;
              acc[mercado.id].produtos.push({
                nome: produto.nome,
                nomeEncontrado: s.nome_produto,
                tipoBusca: 'similar',
                similarInfo: {
                  nomeOriginal: resolved.nome,
                  motivo: s.motivo,
                  score: s.score_relevancia,
                },
                quantidade, precoUnitario: s.preco, subtotal: s.preco * quantidade,
                naoEncontrado: false,
              });
            } else {
              acc[mercado.id].produtos.push({
                nome: produto.nome,
                nomeEncontrado: resolved.nome,
                tipoBusca: produto.id ? 'id' : 'nome',
                quantidade, precoUnitario: 0, subtotal: 0, naoEncontrado: true,
              });
            }
          } catch (simErr) {
            console.warn('Fallback similar falhou:', simErr);
            acc[mercado.id].produtos.push({
              nome: produto.nome,
              nomeEncontrado: resolved.nome,
              tipoBusca: produto.id ? 'id' : 'nome',
              quantidade, precoUnitario: 0, subtotal: 0, naoEncontrado: true,
            });
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
