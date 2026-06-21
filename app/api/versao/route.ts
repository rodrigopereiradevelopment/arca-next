import { NextResponse } from "next/server";

const VERSAO_ATUAL = {
  versao: "1.1.5",
  versionCode: 15,
  url: "https://github.com/rodrigopereiradevelopment/arca-ionic/releases/download/v1.1.5/app-debug.apk",
  obrigatorio: false,
  mensagem: "Busca por produtos similares com embeddings (Fase 2) — resultados mais precisos.",
};

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(VERSAO_ATUAL, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
