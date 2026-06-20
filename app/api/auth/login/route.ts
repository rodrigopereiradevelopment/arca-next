import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/db/supabase';
import { sanitizeEmail, isValidEmail } from '@/lib/validation';
import { logLoginFailure } from '@/lib/audit';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }});
}

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json();
  
  // Sanitizar e validar email
  const sanitizedEmail = sanitizeEmail(email);
  if (!sanitizedEmail || !isValidEmail(sanitizedEmail)) {
    return NextResponse.json({ erro: 'Email inválido' }, { status: 400 });
  }
  
  if (!senha) {
    return NextResponse.json({ erro: 'Senha é obrigatória' }, { status: 400 });
  }
  
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: sanitizedEmail, password: senha });
  
  if (error) {
    // Log falha de login
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    logLoginFailure(ip, sanitizedEmail, '/api/auth/login', error.message);
  }
  if (error) return NextResponse.json({ erro: error.message }, { status: 401 });
  const { data: perfil } = await supabase
    .from('profiles').select('nome, role, foto_perfil').eq('id', data.user.id).maybeSingle();
  return NextResponse.json({
    id: data.user.id,
    email: data.user.email,
    nome: perfil?.nome || email.split('@')[0],
    tipo: perfil?.role || 'usuario',
    foto_perfil: perfil?.foto_perfil || null,
    token: data.session?.access_token
  });
}
