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
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: any = {};
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token necessario", 401);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const { data, error } = await supabase
      .from("tickets_mensagens")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    if (error) return corsErr(error.message, 500);
    return corsOk(data ?? []);
  } catch (err) {
    console.error("[tickets] mensagens GET error:", err);
    return corsErr("Erro interno", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token necessario", 401);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const { texto } = body;
    if (!texto || !texto.trim()) return corsErr("texto obrigatorio", 400);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const isMod = profile?.role === "admin" || profile?.role === "moderador";

    const query = supabase.from("tickets").select("id, status").eq("id", id);
    if (!isMod) query.eq("user_id", user.id);
    const { data: ticket } = await query.single();

    if (!ticket) return corsErr("Ticket nao encontrado", 404);
    if (ticket.status === "resolvido") return corsErr("Ticket ja resolvido", 400);

    const autor = isMod ? "suporte" : "usuario";
    const { data, error } = await supabase
      .from("tickets_mensagens")
      .insert({ ticket_id: parseInt(id), autor, texto: texto.trim() })
      .select()
      .single();

    if (error) return corsErr(error.message, 500);
    return corsOk(data);
  } catch (err) {
    console.error("[tickets] mensagens POST error:", err);
    return corsErr("Erro interno", 500);
  }
}
