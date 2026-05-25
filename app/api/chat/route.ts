import { NextRequest, NextResponse } from 'next/server';

// 1. Trata a requisição de pré-configuração (CORS) que o Ionic faz antes do POST
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// 2. Processa a pergunta do usuário e chama o Gemini
export async function POST(req: NextRequest) {
  try {
    const { pergunta } = await req.json();

    console.log("CHAVE DETECTADA NO SERVER:", process.env.geminiKey);

    if (!pergunta) {
      return NextResponse.json(
        { resposta: 'Por favor, envie uma pergunta válida.' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Ajustado para 'geminiKey', exatamente como está cadastrado na sua Vercel
    const apiKey = process.env.geminiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Você é o assistente virtual do ARCA, app de comparação de preços de supermercados em Mogi Mirim, SP. Responda em português, de forma amigável e objetiva. Máximo 3 parágrafos.\n\nPergunta: ${pergunta}`
              }
            ]
          }
        ]
      })
    });

    const data = await res.json();

    // Valida se a estrutura do Gemini veio correta
    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      console.error('Erro na resposta da API do Google:', data);
      return NextResponse.json(
        { resposta: 'Desculpe, o assistente encontrou uma instabilidade. Tente novamente!' },
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const texto = data.candidates[0].content.parts[0].text;
    
    // Retorna o texto liberando o CORS para o seu app rodar fora do localhost
    return NextResponse.json(
      { resposta: texto },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error) {
    console.error('Erro interno no servidor do chat:', error);
    return NextResponse.json(
      { resposta: 'Erro interno ao processar a mensagem no servidor do ARCA.' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}