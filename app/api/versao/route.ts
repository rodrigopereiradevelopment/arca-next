import { NextResponse } from "next/server";

const VERSAO_ATUAL = {
  versao: "1.1.8",
  versionCode: 18,
  url: "",
  obrigatorio: false,
  mensagem: "Versão de teste — download via <a> tag.",
};
VERSAO_ATUAL.url = `https://github.com/rodrigopereiradevelopment/arca-ionic/releases/download/v${VERSAO_ATUAL.versao}/arca-v${VERSAO_ATUAL.versao}.apk`;

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(VERSAO_ATUAL, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
