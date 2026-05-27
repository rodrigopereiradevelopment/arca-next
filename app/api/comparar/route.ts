import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

// Definindo o tipo dos mercados
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

// Preço máximo considerado razoável (evita produtos errados como equipamentos)
const PRECO_MAXIMO_RAZOAVEL = 500;

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
    
    // Para cada produto, busca o melhor preço em cada mercado
    for (const produto of produtos) {
      console.log(`  📦 Processando: ${produto.nome} (qtd: ${produto.quantidade})`);
      
      let precosEncontrados: any[] = [];
      
      // 1. Tenta preço exato por ID (se tiver ID)
      if (produto.id) {
        const { data: precos } = await supabase
          .from("precos")
          .select("preco, supermercado_id")
          .eq("produto_id", produto.id)
          .in("supermercado_id", MERCADOS_IDS)
          .order("data_coleta", { ascending: false });
        
        if (precos && precos.length > 0) {
          precosEncontrados = precos;
          console.log(`    ✅ Achou por ID: ${produto.id}`);
        }
      }
      
      // 2. Se não achou, busca similar POR MERCADO (não um único produto global)
      if (precosEncontrados.length === 0) {
        const palavras = produto.nome.split(" ").slice(0, 2).join(" ");
        const { data: similares } = await supabase
          .from("produtos")
          .select("id, nome")
          .ilike("nome_normalizado", `%${palavras.toLowerCase()}%`)
          .limit(20);  // mais candidatos

        if (similares && similares.length > 0) {
          const ids = similares.map(s => s.id);

          // Busca preços de TODOS os similares de uma vez
          const { data: todosPrecoss } = await supabase
            .from("precos")
            .select("preco, supermercado_id, produto_id")
            .in("produto_id", ids)
            .in("supermercado_id", MERCADOS_IDS)
            .order("data_coleta", { ascending: false });

          if (todosPrecoss) {
            // Para cada mercado, pega o menor preço entre todos os similares
            for (const mercadoId of MERCADOS_IDS) {
              const precosMercado = todosPrecoss
                .filter(p => p.supermercado_id === mercadoId && p.preco > 0 && p.preco < PRECO_MAXIMO_RAZOAVEL)
                .sort((a, b) => a.preco - b.preco);

              if (precosMercado.length > 0) {
                precosEncontrados.push(precosMercado[0]);
              }
            }
          }
        }
      }
      
      // 3. Agrupa preços por mercado (pega o mais recente/menor)
      const precosPorMercado: Partial<Record<MercadoId, number>> = {};
      if (precosEncontrados.length > 0) {
        for (const p of precosEncontrados) {
          const mercadoId = p.supermercado_id as MercadoId;
          const precoAtual = precosPorMercado[mercadoId];
          if (!precoAtual || p.preco < precoAtual) {
            precosPorMercado[mercadoId] = p.preco;
          }
        }
      }
      
      // 4. Acumula totais por mercado
      for (const mercadoId of MERCADOS_IDS) {
        const preco = precosPorMercado[mercadoId] || 0;
        const quantidade = produto.quantidade || 1;
        
        if (preco > 0 && preco < PRECO_MAXIMO_RAZOAVEL) {
          resultadosPorMercado[mercadoId].total += preco * quantidade;
          resultadosPorMercado[mercadoId].itens++;
          resultadosPorMercado[mercadoId].produtos.push({
            nome: produto.nome,
            quantidade: quantidade,
            precoUnitario: preco,
            subtotal: preco * quantidade
          });
        } else {
          resultadosPorMercado[mercadoId].produtos.push({
            nome: produto.nome,
            quantidade: quantidade,
            precoUnitario: 0,
            subtotal: 0,
            naoEncontrado: true
          });
        }
      }
    }
    
    // Formata resposta
    const resposta: RespostaMercado[] = MERCADOS_IDS.map((id) => ({
      id: id,
      nome: SUPERMERCADOS[id],
      total: resultadosPorMercado[id].total,
      itensEncontrados: resultadosPorMercado[id].itens,
      totalProdutos: produtos.length,
      produtos: resultadosPorMercado[id].produtos
    }));
    
    resposta.sort((a, b) => a.total - b.total);
    
    console.log(`✅ Comparação finalizada. Top mercado: ${resposta[0]?.nome} (R$ ${resposta[0]?.total})`);
    
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