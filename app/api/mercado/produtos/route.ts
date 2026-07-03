import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import { getMercadoAdmin } from "@/lib/mercado-auth";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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

export async function GET(req: NextRequest) {
  try {
    const token = extrairToken(req);
    if (!token) return corsErr("Token obrigatório", 401);

    const admin = await getMercadoAdmin(token);
    if (!admin) return corsErr("Sem permissão", 403);

    const supabase = getSupabaseServerClient();
    const params = req.nextUrl.searchParams;
    const page = parseInt(params.get("pagina") || "1", 10);
    const busca = params.get("busca") || "";
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("precos")
      .select("id, preco, promocao, descricao_promocao, data_coleta, verificado, produto_id, produtos!inner(id, nome, codigo_barras, imagem_url, categoria_id)")
      .eq("supermercado_id", admin.mercadoId);

    if (busca) {
      query = query.or(`produtos.nome.ilike.%${busca}%,produtos.codigo_barras.ilike.%${busca}%`);
    }

    const { data, error } = await query
      .order("data_coleta", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return corsErr(error.message, 500);

    const produtos = (data || []).map(r => ({
      precoId: r.id,
      produtoId: r.produto_id,
      nome: (r as any).produtos?.nome || "",
      ean: (r as any).produtos?.codigo_barras || "",
      imagem: (r as any).produtos?.imagem_url || "",
      preco: r.preco,
      promocao: r.promocao || false,
      descricaoPromocao: r.descricao_promocao || "",
      verificado: r.verificado || false,
      data: r.data_coleta,
    }));

    return corsOk({ produtos, pagina: page });
  } catch (error) {
    return corsErr(error instanceof Error ? error.message : "Erro", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = extrairToken(req);
    if (!token) return corsErr("Token obrigatório", 401);

    const admin = await getMercadoAdmin(token);
    if (!admin) return corsErr("Sem permissão", 403);

    const body = await req.json();
    const { acao, produtoId, preco, promocao, descricaoPromocao } = body;

    if (!produtoId) return corsErr("produtoId obrigatório", 400);

    const supabase = getSupabaseServerClient();

    if (acao === "upsert") {
      if (preco === undefined || preco === null) return corsErr("preco obrigatório", 400);

      const { data, error } = await supabase
        .from("precos")
        .insert({
          produto_id: produtoId,
          supermercado_id: admin.mercadoId,
          preco,
          promocao: promocao || false,
          descricao_promocao: descricaoPromocao || null,
          fonte_dados: "manual",
          verificado: true,
        })
        .select()
        .single();

      if (error) return corsErr(error.message, 500);
      return corsOk(data, 201);
    }

    if (acao === "bulk") {
      const { itens } = body;
      if (!Array.isArray(itens) || itens.length === 0) {
        return corsErr("Envie um array de itens", 400);
      }

      const inserts = itens.map((item: any) => ({
        produto_id: item.produtoId,
        supermercado_id: admin.mercadoId,
        preco: item.preco,
        promocao: item.promocao || false,
        descricao_promocao: item.descricaoPromocao || null,
        fonte_dados: "manual",
        verificado: true,
      }));

      const { data, error } = await supabase.from("precos").insert(inserts).select();
      if (error) return corsErr(error.message, 500);
      return corsOk({ inseridos: data?.length || 0 }, 201);
    }

    return corsErr("Ação inválida (use upsert ou bulk)", 400);
  } catch (error) {
    return corsErr(error instanceof Error ? error.message : "Erro", 500);
  }
}
