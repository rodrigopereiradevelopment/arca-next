import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
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

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from("notificacoes")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return corsErr(error.message, 500);

    return corsOk({
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
      naoLidas: (data ?? []).filter((n: any) => !n.lida).length,
    });
  } catch (err) {
    console.error("[notificacoes] GET error:", err);
    return corsErr("Erro interno", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token necessario", 401);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const { titulo, mensagem, tipo = "sistema", dados_extras } = body;
    if (!titulo || !mensagem) return corsErr("titulo e mensagem obrigatorios", 400);

    const tiposValidos = ["alerta_preco", "promocao", "sistema", "marketing"];
    if (!tiposValidos.includes(tipo)) return corsErr("tipo invalido", 400);

    const { data, error } = await supabase
      .from("notificacoes")
      .insert({
        user_id: user.id,
        titulo,
        mensagem,
        tipo,
        dados_extras: dados_extras ?? null,
      })
      .select()
      .single();

    if (error) return corsErr(error.message, 500);
    return corsOk(data);
  } catch (err) {
    console.error("[notificacoes] POST error:", err);
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

    const { id, lida, todas } = body;

    if (todas) {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true, data_leitura: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("lida", false);

      if (error) return corsErr(error.message, 500);
      return corsOk({ sucesso: true, todas: true });
    }

    if (!id) return corsErr("id obrigatorio", 400);

    const updateData: Record<string, any> = {};
    if (lida !== undefined) {
      updateData.lida = lida;
      updateData.data_leitura = lida ? new Date().toISOString() : null;
    }

    if (Object.keys(updateData).length === 0) {
      return corsErr("Nenhum campo para atualizar", 400);
    }

    const { data, error } = await supabase
      .from("notificacoes")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select();

    if (error) return corsErr(error.message, 500);
    if (!data || data.length === 0) return corsErr("Notificacao nao encontrada", 404);
    return corsOk(data[0]);
  } catch (err) {
    console.error("[notificacoes] PUT error:", err);
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

    const { id, todas } = body;

    if (todas) {
      const { error } = await supabase
        .from("notificacoes")
        .delete()
        .eq("user_id", user.id);

      if (error) return corsErr(error.message, 500);
      return corsOk({ sucesso: true, todas: true });
    }

    if (!id) return corsErr("id obrigatorio", 400);

    const { error } = await supabase
      .from("notificacoes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return corsErr(error.message, 500);
    return corsOk({ sucesso: true });
  } catch (err) {
    console.error("[notificacoes] DELETE error:", err);
    return corsErr("Erro interno", 500);
  }
}
