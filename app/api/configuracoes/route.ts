import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

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

function extrairToken(req: NextRequest, body: any): string | null {
  if (body?.token && typeof body.token === "string") return body.token;
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
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
      .from("configuracoes_usuario")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return corsErr(error.message, 500);

    return corsOk(data ?? {});
  } catch (err) {
    console.error("[configuracoes] GET error:", err);
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

    const {
      modo_escuro, notificacao_promocoes, notificacoes_email,
      notificacoes_push, raio_busca_km, ordenacao_padrao, exibir_apenas_promocoes,
    } = body;

    const upsertData: Record<string, any> = { user_id: user.id };
    if (modo_escuro !== undefined) upsertData.modo_escuro = modo_escuro;
    if (notificacao_promocoes !== undefined) upsertData.notificacao_promocoes = notificacao_promocoes;
    if (notificacoes_email !== undefined) upsertData.notificacoes_email = notificacoes_email;
    if (notificacoes_push !== undefined) upsertData.notificacoes_push = notificacoes_push;
    if (raio_busca_km !== undefined) upsertData.raio_busca_km = raio_busca_km;
    if (ordenacao_padrao !== undefined) upsertData.ordenacao_padrao = ordenacao_padrao;
    if (exibir_apenas_promocoes !== undefined) upsertData.exibir_apenas_promocoes = exibir_apenas_promocoes;

    const { error: upsertErr } = await supabase
      .from("configuracoes_usuario")
      .upsert(upsertData, { onConflict: "user_id" });

    if (upsertErr) return corsErr(upsertErr.message, 500);

    return corsOk({ sucesso: true });
  } catch (err) {
    console.error("[configuracoes] POST error:", err);
    return corsErr("Erro interno", 500);
  }
}
