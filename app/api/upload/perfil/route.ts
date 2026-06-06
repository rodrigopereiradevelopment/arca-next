import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";
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
    const formData = await req.formData();
    const token = formData.get("token") as string | null;
    const file = formData.get("file") as File | null;

    if (!token) return corsErr("Token necessario", 401);
    if (!file) return corsErr("Arquivo obrigatorio", 400);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "webp";
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const storageClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: upload, error: uploadErr } = await storageClient
      .storage
      .from("avatars")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      if (uploadErr.message.includes("bucket")) {
        await storageClient.storage.createBucket("avatars", { public: true });
        const retry = await storageClient.storage.from("avatars").upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });
        if (retry.error) return corsErr("Erro ao fazer upload", 500);
      } else {
        return corsErr(uploadErr.message, 500);
      }
    }

    const { data: urlData } = storageClient
      .storage
      .from("avatars")
      .getPublicUrl(fileName);

    const fotoUrl = urlData?.publicUrl || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ foto_perfil: fotoUrl })
      .eq("id", user.id);

    if (updateErr) return corsErr(updateErr.message, 500);

    return corsOk({ url: fotoUrl });
  } catch (err) {
    console.error("[upload/perfil] POST error:", err);
    return corsErr("Erro interno", 500);
  }
}
