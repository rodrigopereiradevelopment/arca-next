import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";
import { getMercadoAdmin } from "@/lib/mercado-auth";

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
    if (!admin) return corsErr("Sem permissão de mercado_admin", 403);
    if (admin.mercadoId === 0) {
      return corsOk({
        mercado: { id: 0, nome: "Visualização Admin", logo_url: "", status: "—", cidade: "—", responsavel: "" },
        totalProdutos: 0,
        precosAtivos: 0,
        atualizacoesRecentes: [],
      });
    }

    const supabase = getSupabaseServerClient();

    const [infoMercado, totalProdutos, precosAtivos, recentes] = await Promise.all([
      supabase.from("supermercados").select("id, nome, logo_url, status, cidade, responsavel").eq("id", admin.mercadoId).single(),
      supabase.from("precos").select("id", { count: "exact", head: true }).eq("supermercado_id", admin.mercadoId),
      supabase.from("precos").select("id", { count: "exact", head: true }).eq("supermercado_id", admin.mercadoId).gte("data_coleta", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("precos").select("id, produto_id, preco, data_coleta, produtos!inner(nome)").eq("supermercado_id", admin.mercadoId).order("data_coleta", { ascending: false }).limit(10),
    ]);

    if (infoMercado.error) return corsErr("Mercado não encontrado", 404);

    return corsOk({
      mercado: infoMercado.data,
      totalProdutos: totalProdutos.count || 0,
      precosAtivos: precosAtivos.count || 0,
      atualizacoesRecentes: (recentes.data || []).map(r => ({
        id: r.id,
        produtoId: r.produto_id,
        nome: (r as any).produtos?.nome || "",
        preco: r.preco,
        data: r.data_coleta,
      })),
    });
  } catch (error) {
    return corsErr(error instanceof Error ? error.message : "Erro no dashboard", 500);
  }
}
