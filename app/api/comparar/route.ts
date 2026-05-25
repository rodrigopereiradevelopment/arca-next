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
const PRECO_MAXIMO_RAZOAVEL = 50;

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
      
      // 2. Se não achou, busca similar por nome (com limite de preço)
      if (precosEncontrados.length === 0) {
        console.log(`    🔍 Buscando similar para: ${produto.nome}`);
        
        // Busca produtos com nome similar
        const { data: similares } = await supabase
          .from("produtos")
          .select("id, nome")
          .ilike("nome", `%${produto.nome.split(" ")[0]}%`)
          .limit(10);
        
        if (similares && similares.length > 0) {
          // Para cada similar, busca preços
          for (const similar of similares) {
            const { data: precosSimilar } = await supabase
              .from("precos")
              .select("preco, supermercado_id")
              .eq("produto_id", similar.id)
              .in("supermercado_id", MERCADOS_IDS)
              .order("data_coleta", { ascending: false });
            
            if (precosSimilar && precosSimilar.length > 0) {
              // Verifica se tem preços razoáveis
              const precoMinimo = Math.min(...precosSimilar.map(p => p.preco));
              if (precoMinimo > 0 && precoMinimo < PRECO_MAXIMO_RAZOAVEL) {
                precosEncontrados = precosSimilar;
                console.log(`    ✅ Achou similar: ${similar.nome} (R$ ${precoMinimo})`);
                break;
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