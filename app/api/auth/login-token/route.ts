import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { token } = await req.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });

  const { data: perfil } = await supabase
    .from('profiles')
    .select('nome, role')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    id: user.id,
    email: user.email,
    nome: perfil?.nome || user.email?.split('@')[0],
    tipo: perfil?.role || 'usuario',
    token
  });
}