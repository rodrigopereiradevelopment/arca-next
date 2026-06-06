import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
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
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "30")));

    const { data, error } = await supabase
      .from("atividades_recentes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return corsErr(error.message, 500);
    return corsOk(data ?? []);
  } catch (err) {
    console.error("[historico] GET error:", err);
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

    const { tipo, descricao, detalhe, rota, icone } = body;
    if (!tipo || !descricao) return corsErr("tipo e descricao obrigatorios", 400);

    const tiposValidos = ["pesquisa", "comparacao", "rota"];
    if (!tiposValidos.includes(tipo)) return corsErr("tipo invalido", 400);

    const { data, error } = await supabase
      .from("atividades_recentes")
      .insert({ user_id: user.id, tipo, descricao, detalhe: detalhe ?? null, rota: rota ?? null, icone: icone ?? "📋" })
      .select()
      .single();

    if (error) return corsErr(error.message, 500);
    return corsOk(data);
  } catch (err) {
    console.error("[historico] POST error:", err);
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
      const { error } = await supabase.from("atividades_recentes").delete().eq("user_id", user.id);
      if (error) return corsErr(error.message, 500);
      return corsOk({ sucesso: true, todas: true });
    }

    if (!id) return corsErr("id obrigatorio", 400);

    const { error } = await supabase.from("atividades_recentes").delete().eq("id", id).eq("user_id", user.id);
    if (error) return corsErr(error.message, 500);
    return corsOk({ sucesso: true });
  } catch (err) {
    console.error("[historico] DELETE error:", err);
    return corsErr("Erro interno", 500);
  }
}
