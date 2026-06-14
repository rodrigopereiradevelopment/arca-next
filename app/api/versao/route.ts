import { NextResponse } from "next/server";

const VERSAO_ATUAL = {
  versao: "1.0.9",
  versionCode: 9,
  url: "https://github.com/rodrigopereiradevelopment/arca-ionic/releases/latest",
  obrigatorio: false,
  mensagem: "Correções de bugs e melhorias de desempenho.",
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
