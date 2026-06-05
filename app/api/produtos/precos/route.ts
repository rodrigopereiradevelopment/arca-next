import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsOk(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

function corsErr(erro: string, status: number) {
  return NextResponse.json({ erro }, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function formatarPreco(p: any) {
  return {
    id: p.id,
    preco: p.preco,
    promocao: p.promocao,
    descricao_promocao: p.descricao_promocao || "",
    data_coleta: p.data_coleta,
    supermercado_id: p.supermercado_id,
    supermercado: p.supermercados?.nome || "Desconhecido",
  };
}

export async function GET(req: NextRequest) {
  try {
    const produtoId = req.nextUrl.searchParams.get("produto_id");
    const supabase = getSupabaseServerClient();

    if (produtoId) {
      const { data, error } = await supabase
        .from("precos")
        .select("id, preco, promocao, descricao_promocao, data_coleta, supermercado_id, supermercados(nome)")
        .eq("produto_id", parseInt(produtoId))
        .order("data_coleta", { ascending: false })
        .limit(50);

      if (error) throw error;

      return corsOk(
        (data ?? []).map((p: any) => formatarPreco(p))
      );
    }

    const { data, error } = await supabase
      .from("precos")
      .select("id, preco, promocao, descricao_promocao, data_coleta, produto_id, supermercado_id, produtos(nome), supermercados(nome)")
      .order("data_coleta", { ascending: false })
      .limit(20);

    if (error) throw error;

    return corsOk(
      (data ?? []).map((p: any) => ({
        ...formatarPreco(p),
        produto_id: p.produto_id,
        produto: p.produtos?.nome || "",
      }))
    );
  } catch (error) {
    console.error("[produtos/precos] GET error:", error);
    return corsErr(
      error instanceof Error ? error.message : "Erro ao listar preços",
      500
    );
  }
}
