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

export async function POST(req: NextRequest) {
  try {
    const { pergunta, historico } = await req.json();

    if (!pergunta) {
      return NextResponse.json(
        { resposta: 'Por favor, envie uma pergunta válida.' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const apiKey = process.env.geminiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

    const parts: any[] = [
      { text: 'Você é o assistente virtual do ARCA, app de comparação de preços de supermercados em Mogi Mirim, SP. Responda em português, de forma amigável e objetiva. Máximo 3 parágrafos.' }
    ];

    if (Array.isArray(historico)) {
      for (const msg of historico.slice(-6)) {
        if (msg.autor === 'usuario') parts.push({ text: `Usuário: ${msg.texto}` });
        else parts.push({ text: `Assistente: ${msg.texto}` });
      }
    }

    parts.push({ text: `Usuário: ${pergunta}` });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    const data = await res.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      console.error('Erro na resposta do Gemini:', data);
      return NextResponse.json(
        { resposta: 'Desculpe, o assistente encontrou uma instabilidade. Tente novamente!' },
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return NextResponse.json(
      { resposta: data.candidates[0].content.parts[0].text },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error) {
    console.error('Erro interno no chat:', error);
    return NextResponse.json(
      { resposta: 'Erro interno ao processar a mensagem no servidor do ARCA.' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}