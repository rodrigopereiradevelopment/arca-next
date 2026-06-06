import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsOk(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

function corsErr(erro: string, status: number) {
  return NextResponse.json({ erro }, { status, headers: CORS_HEADERS });
}

function extrairToken(req: NextRequest, body: any): string | null {
  if (body?.token && typeof body.token === "string") return body.token;
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const body: any = {};
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token necessario", 401);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const { data, error } = await supabase
      .from("alerta_preco")
      .select("*, produtos:produto_id(nome, imagem_url)")
      .eq("user_id", user.id)
      .order("data_criacao", { ascending: false });

    if (error) return corsErr(error.message, 500);

    const alertas = (data ?? []).map((a: any) => ({
      id: a.id,
      produto_id: a.produto_id,
      produto: a.produtos?.nome || "Produto",
      imagem: a.produtos?.imagem_url || "",
      precoDesejado: a.preco_desejado,
      ativo: a.ativo ?? true,
      dataCriacao: a.data_criacao,
      dataUltimoAlerta: a.data_ultimo_alerta,
      notificacoesEnviadas: a.notificacoes_enviadas ?? 0,
      supermercado_id: a.supermercado_id,
    }));

    return corsOk(alertas);
  } catch (err) {
    console.error("[alertas] GET error:", err);
    return corsErr("Erro interno", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token necessario", 401);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const { id, ativo } = body;
    if (!id) return corsErr("id obrigatorio", 400);

    const updateData: Record<string, any> = {};
    if (ativo !== undefined) updateData.ativo = ativo;

    if (Object.keys(updateData).length === 0) {
      return corsErr("Nenhum campo para atualizar", 400);
    }

    const { data, error } = await supabase
      .from("alerta_preco")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select();

    if (error) return corsErr(error.message, 500);
    if (!data || data.length === 0) return corsErr("Alerta nao encontrado", 404);
    return corsOk(data[0]);
  } catch (err) {
    console.error("[alertas] PUT error:", err);
    return corsErr("Erro interno", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token necessario", 401);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const { id } = body;
    if (!id) return corsErr("id obrigatorio", 400);

    const { error } = await supabase
      .from("alerta_preco")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return corsErr(error.message, 500);
    return corsOk({ sucesso: true });
  } catch (err) {
    console.error("[alertas] DELETE error:", err);
    return corsErr("Erro interno", 500);
  }
}
