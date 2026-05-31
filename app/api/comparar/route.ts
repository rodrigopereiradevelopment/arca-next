import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

type MercadoId = 1 | 2 | 3 | 4 | 5 | 6;

const SUPERMERCADOS: Record<MercadoId, string> = {
  1: 'GoodBom',
  2: 'PagueMenos',
  3: 'São Vicente',
  4: 'Atacadão',
  5: 'Imperial',
  6: 'Ponto Novo'
};

const MERCADOS_IDS: MercadoId[] = [1, 2, 3, 4, 5, 6];

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

export async function POST(req: NextRequest) {
  try {
    const { produtos } = await req.json() as { produtos: ProdutoItem[] };
    console.log(`🔍 Comparando ${produtos.length} produtos...`);

    const supabase = getSupabaseServerClient();

    const resultadosPorMercado: Record<MercadoId, ResultadoMercado> = {
      1: { total: 0, itens: 0, produtos: [] },
      2: { total: 0, itens: 0, produtos: [] },
      3: { total: 0, itens: 0, produtos: [] },
      4: { total: 0, itens: 0, produtos: [] },
      5: { total: 0, itens: 0, produtos: [] },
      6: { total: 0, itens: 0, produtos: [] }
    };

    for (const produto of produtos) {
      console.log(`\n📦 Processando: ${produto.nome} (qtd: ${produto.quantidade})`);

      // Para cada mercado, chama a RPC buscar_melhor_preco
      // Roda todos os mercados em paralelo (mais rápido!)
      const resultados = await Promise.all(
        MERCADOS_IDS.map(async (mercadoId) => {
          try {
            const { data, error } = await supabase.rpc('buscar_melhor_preco', {
              p_produto_id: produto.id ?? null,
              p_nome: produto.nome,
              p_mercado_id: mercadoId,
              p_dias_max: 30
            });

            console.log(`  🔎 Mercado ${mercadoId} raw:`, JSON.stringify({ data, error }));

            if (error || !data || data.length === 0) {
              console.log(`  ❌ Mercado ${mercadoId} (${SUPERMERCADOS[mercadoId]}): não encontrado`);
              return { mercadoId, preco: 0, nomeUsado: null, tipoBusca: null };
            }

            const resultado = data[0];
            console.log(`  ✅ Mercado ${mercadoId} (${SUPERMERCADOS[mercadoId]}): R$ ${resultado.preco} | ${resultado.tipo_busca} | ${resultado.nome_usado}`);

            return {
              mercadoId,
              preco: resultado.preco,
              nomeUsado: resultado.nome_usado,
              tipoBusca: resultado.tipo_busca
            };
          } catch (err) {
            console.error(`  ❌ Erro mercado ${mercadoId}:`, err);
            return { mercadoId, preco: 0, nomeUsado: null, tipoBusca: null };
          }
        })
      );

      // Acumula resultados por mercado
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

    // Monta resposta final
    const resposta: RespostaMercado[] = MERCADOS_IDS.map((id) => ({
      id,
      nome: SUPERMERCADOS[id],
      total: resultadosPorMercado[id].total,
      itensEncontrados: resultadosPorMercado[id].itens,
      totalProdutos: produtos.length,
      produtos: resultadosPorMercado[id].produtos
    }));

    // Ordena por menor preço (sem dados vai pro fim)
    resposta.sort((a, b) => {
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return a.total - b.total;
    });

    console.log(`\n✅ Top mercado: ${resposta[0]?.nome} (R$ ${resposta[0]?.total.toFixed(2)})`);

    return NextResponse.json({
      sucesso: true,
      mercados: resposta,
      totalProdutos: produtos.length
    });

  } catch (error) {
    console.error("❌ Erro no comparador:", error);
    return NextResponse.json(
      { sucesso: false, erro: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}