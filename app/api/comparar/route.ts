import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 204, headers: CORS_HEADERS });
}

type MercadoId = number;

interface ProdutoItem {
  id?: number;
  nome: string;
  quantidade: number;
}

interface ResultadoMercado {
  total: number;
  itens: number;
  produtos: any[];
}

interface RespostaMercado {
  id: number;
  nome: string;
  total: number;
  itensEncontrados: number;
  totalProdutos: number;
  produtos: any[];
}

let mercadosCache: { id: number; nome: string }[] | null = null;

async function getMercados(): Promise<{ id: number; nome: string }[]> {
  if (mercadosCache) return mercadosCache;
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("supermercados").select("id, nome").order("id");
  mercadosCache = (data ?? []).map((m: any) => ({ id: m.id, nome: m.nome }));
  return mercadosCache;
}

export async function POST(req: NextRequest) {
  try {
    const { produtos } = await req.json() as { produtos: ProdutoItem[] };

    const supabase = getSupabaseServerClient();
    const mercados = await getMercados();

    if (mercados.length === 0) {
      return NextResponse.json({ sucesso: false, erro: "Nenhum mercado cadastrado" }, { status: 404, headers: CORS_HEADERS });
    }

    const resultadosPorMercado: Record<number, ResultadoMercado> = {};
    for (const m of mercados) {
      resultadosPorMercado[m.id] = { total: 0, itens: 0, produtos: [] };
    }

    for (const produto of produtos) {
      const resultados = await Promise.all(
        mercados.map(async (mercado) => {
          try {
            const { data, error } = await supabase.rpc('buscar_melhor_preco', {
              p_produto_id: produto.id ?? null,
              p_nome: produto.nome,
              p_mercado_id: mercado.id,
              p_dias_max: 30
            });

            if (error || !data || data.length === 0) {
              return { mercadoId: mercado.id, preco: 0, nomeUsado: null, tipoBusca: null };
            }

            const resultado = data[0];
            return {
              mercadoId: mercado.id,
              preco: resultado.preco,
              nomeUsado: resultado.nome_usado,
              tipoBusca: resultado.tipo_busca
            };
          } catch {
            return { mercadoId: mercado.id, preco: 0, nomeUsado: null, tipoBusca: null };
          }
        })
      );

      for (const resultado of resultados) {
        const { mercadoId, preco, nomeUsado, tipoBusca } = resultado;
        const quantidade = produto.quantidade || 1;

        if (preco > 0) {
          resultadosPorMercado[mercadoId].total += preco * quantidade;
          resultadosPorMercado[mercadoId].itens++;
          resultadosPorMercado[mercadoId].produtos.push({
            nome: produto.nome,
            nomeEncontrado: nomeUsado,
            tipoBusca,
            quantidade,
            precoUnitario: preco,
            subtotal: preco * quantidade,
            naoEncontrado: false
          });
        } else {
          resultadosPorMercado[mercadoId].produtos.push({
            nome: produto.nome,
            nomeEncontrado: null,
            tipoBusca: null,
            quantidade,
            precoUnitario: 0,
            subtotal: 0,
            naoEncontrado: true
          });
        }
      }
    }

    const nomesPorId: Record<number, string> = {};
    for (const m of mercados) nomesPorId[m.id] = m.nome;

    const resposta: RespostaMercado[] = mercados.map((m) => ({
      id: m.id,
      nome: nomesPorId[m.id],
      total: resultadosPorMercado[m.id].total,
      itensEncontrados: resultadosPorMercado[m.id].itens,
      totalProdutos: produtos.length,
      produtos: resultadosPorMercado[m.id].produtos
    }));

    resposta.sort((a, b) => {
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return a.total - b.total;
    });

    return NextResponse.json({
      sucesso: true,
      mercados: resposta,
      totalProdutos: produtos.length
    }, { headers: CORS_HEADERS });

  } catch (error) {
    console.error("Erro no comparador:", error);
    return NextResponse.json(
      { sucesso: false, erro: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
