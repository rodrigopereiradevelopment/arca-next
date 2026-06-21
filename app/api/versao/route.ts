import { NextResponse } from "next/server";

const VERSAO_ATUAL = {
  versao: "1.1.6",
  versionCode: 16,
  url: "",
  obrigatorio: false,
  mensagem: "Versão dinâmica via App.getInfo() + UX download melhorada.",
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
