import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }});
}

export async function POST(req: NextRequest) {
  const { token, novaSenha } = await req.json();

  if (!novaSenha || novaSenha.length < 8) {
    return NextResponse.json({ erro: 'Nova senha deve ter no mínimo 8 caracteres.' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });

  const { error } = await supabase.auth.admin.updateUserById(user.id, { password: novaSenha });
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
