import { NextResponse } from "next/server";

const VERSAO_ATUAL = {
  versao: "1.1.4",
  versionCode: 14,
  url: "https://github.com/rodrigopereiradevelopment/arca-ionic/releases/download/v1.1.4/app-debug.apk",
  obrigatorio: false,
  mensagem: "In-app update: download e instalação direto pelo app, sem ir ao GitHub.",
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
