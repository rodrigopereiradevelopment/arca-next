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

    const supabase = getSupabaseServerClient();

    const { data: mercados } = await supabase.from("supermercados").select("id, nome").order("id");
    if (!mercados || mercados.length === 0) {
      return NextResponse.json({ sucesso: false, erro: "Nenhum mercado cadastrado" }, { status: 404, headers: CORS_HEADERS });
    }

    // 1. Resolve each product request to a produto_id in one pass
    const idsByname: Record<string, { id: number; nome: string }> = {};
    const nomeToRequest: Record<string, string> = {};

    for (const p of produtos) {
      if (p.id) continue; // will use direct ID

      const termo = p.nome.trim().toUpperCase();
      if (!termo || idsByname[termo]) continue; // already resolved

      const { data: found } = await supabase.from("produtos").select("id, nome")
        .ilike("nome", `%${termo}%`).limit(1);

      if (found && found.length > 0) {
        idsByname[termo] = { id: found[0].id, nome: found[0].nome };
        nomeToRequest[found[0].nome] = p.nome;
      }
    }

    // Collect all produto_ids
    const allIds = new Set<number>();
    for (const p of produtos) {
      if (p.id) allIds.add(p.id);
    }
    for (const v of Object.values(idsByname)) allIds.add(v.id);

    if (allIds.size === 0) {
      return NextResponse.json({ sucesso: false, erro: "Nenhum produto encontrado" }, { status: 404, headers: CORS_HEADERS });
    }

    // 2. Get ALL product names and ALL prices in two queries
    const idList = [...allIds];

    const { data: nomes } = await supabase.from("produtos").select("id, nome").in("id", idList);
    const nomePorId: Record<number, string> = {};
    if (nomes) for (const n of nomes) nomePorId[n.id] = n.nome;

    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: precos } = await supabase
      .from("precos")
      .select("produto_id, supermercado_id, preco, data_coleta")
      .in("produto_id", idList)
      .gte("data_coleta", trintaDiasAtras);

    const priceMap: Record<string, number> = {};
    const dateMap: Record<string, string> = {};
    if (precos) {
      for (const p of precos) {
        const key = `${p.produto_id}_${p.supermercado_id}`;
        if (!dateMap[key] || p.data_coleta > dateMap[key]) {
          priceMap[key] = p.preco;
          dateMap[key] = p.data_coleta;
        }
      }
    }

    // 3. Resolve ID for each product request
    function resolveId(produto: ProdutoItem): { id: number; nome: string } | null {
      if (produto.id && nomePorId[produto.id]) {
        return { id: produto.id, nome: nomePorId[produto.id] };
      }
      const termo = produto.nome.trim().toUpperCase();
      const found = idsByname[termo];
      if (found) return found;
      return null;
    }

    // 4. Build response
    interface MercadoAcc {
      total: number;
      itens: number;
      produtos: any[];
    }
    const acc: Record<number, MercadoAcc> = {};
    for (const m of mercados) {
      acc[m.id] = { total: 0, itens: 0, produtos: [] };
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
          acc[mercado.id].total += preco * quantidade;
          acc[mercado.id].itens++;
          acc[mercado.id].produtos.push({
            nome: produto.nome, nomeEncontrado: resolved.nome,
            tipoBusca: produto.id ? 'id' : 'nome',
            quantidade, precoUnitario: preco, subtotal: preco * quantidade,
            naoEncontrado: false,
          });
        } else {
          acc[mercado.id].produtos.push({
            nome: produto.nome, nomeEncontrado: resolved.nome,
            tipoBusca: produto.id ? 'id' : 'nome',
            quantidade, precoUnitario: 0, subtotal: 0, naoEncontrado: true,
          });
        }
      }
    }

    const resposta = mercados.map((m) => ({
      id: m.id,
      nome: m.nome,
      total: acc[m.id].total,
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
