import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import { getMercadoAdmin } from "@/lib/mercado-auth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsOk(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}
function corsErr(erro: string, status: number) {
  return NextResponse.json({ erro }, { status, headers: CORS_HEADERS });
}

function extrairToken(req: NextRequest): string | null {
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const token = extrairToken(req);
    if (!token) return corsErr("Token obrigatório", 401);

    const admin = await getMercadoAdmin(token);
    if (!admin) return corsErr("Sem permissão", 403);
    if (admin.mercadoId === 0) return corsErr("Admin não pode importar sem mercado vinculado", 400);

    const body = await req.json();
    const { linhas } = body;

    if (!Array.isArray(linhas) || linhas.length === 0) {
      return corsErr("Envie um array de linhas", 400);
    }

    const supabase = getSupabaseServerClient();

    const eans = linhas.filter(l => l.ean).map(l => l.ean);
    const nomes = linhas.filter(l => !l.ean).map(l => l.nome?.toLowerCase());

    let query = supabase.from("produtos").select("id, nome, codigo_barras");
    if (eans.length > 0) {
      query = query.in("codigo_barras", eans);
    }

    const { data: produtosExistentes } = await query;

    const mapaPorEan = new Map((produtosExistentes || []).filter(p => p.codigo_barras).map(p => [p.codigo_barras, p]));
    const mapaPorNome = new Map((produtosExistentes || []).map(p => [p.nome.toLowerCase(), p]));

    // Cria registros de precos e produtos nao encontrados
    const resultados: any[] = [];
    const erros: any[] = [];

    for (const linha of linhas) {
      let produto = null;

      if (linha.ean) {
        produto = mapaPorEan.get(linha.ean) || null;
      }
      if (!produto && linha.nome) {
        produto = mapaPorNome.get(linha.nome.toLowerCase()) || null;
      }

      if (!produto) {
        erros.push({ linha: linha.nome || linha.ean, erro: "Produto não encontrado no catálogo" });
        continue;
      }

      const preco = parseFloat(linha.preco);
      if (isNaN(preco) || preco <= 0) {
        erros.push({ linha: linha.nome || linha.ean, erro: "Preço inválido" });
        continue;
      }

      const { error } = await supabase.from("precos").insert({
        produto_id: produto.id,
        supermercado_id: admin.mercadoId,
        preco,
        promocao: linha.promocao === "true" || linha.promocao === true,
        descricao_promocao: linha.descricao_promocao || null,
        fonte_dados: "manual",
        verificado: true,
      });

      if (error) {
        erros.push({ linha: linha.nome || linha.ean, erro: error.message });
      } else {
        resultados.push({ nome: produto.nome, preco });
      }
    }

    return corsOk({
      importados: resultados.length,
      erros: erros.length,
      resultados,
      errosDetalhe: erros,
    });
  } catch (error) {
    return corsErr(error instanceof Error ? error.message : "Erro na importação", 500);
  }
}
