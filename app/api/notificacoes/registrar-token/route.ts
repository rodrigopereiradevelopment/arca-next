import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let token = body?.token;
    if (!token || typeof token !== "string") {
      const auth = req.headers.get("Authorization");
      if (auth?.startsWith("Bearer ")) token = auth.slice(7);
    }
    if (!token) return corsErr("Token necessario", 401);

    const { fcm_token, plataforma, ativo } = body;
    if (!fcm_token || !plataforma) {
      return corsErr("fcm_token e plataforma obrigatorios", 400);
    }
    if (!["android", "ios", "web"].includes(plataforma)) {
      return corsErr("plataforma invalida (android, ios, web)", 400);
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const { error: upsertErr } = await supabase.from("device_tokens").upsert(
      {
        user_id: user.id,
        token: fcm_token,
        plataforma,
        ativo: ativo !== false,
      },
      {
        onConflict: "token",
        ignoreDuplicates: false,
      }
    ).select();

    if (upsertErr) {
      console.error("[registrar-token] upsert error:", upsertErr);
      return corsErr("Erro ao registrar token", 500);
    }

    return corsOk({ sucesso: true });
  } catch (err) {
    console.error("[registrar-token] POST error:", err);
    return corsErr("Erro interno", 500);
  }
}
