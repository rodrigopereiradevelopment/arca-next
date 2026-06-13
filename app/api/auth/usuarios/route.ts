import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getUserId(token: string) {
  const { data: { user }, error } = await getSupabase().auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

async function isAdmin(token: string) {
  const userId = await getUserId(token);
  if (!userId) return false;
  const { data } = await getSupabase().from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'admin';
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }});
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 });
  }
  const { data } = await getSupabase()
    .from('profiles')
    .select('id, nome, role')
    .order('nome');
  
  // busca emails do auth.users
  const { data: authUsers } = await getSupabase().auth.admin.listUsers();
  
  const usuarios = data?.map(p => {
    const authUser = authUsers?.users.find(u => u.id === p.id);
    return {
      id: p.id,
      nome: p.nome || authUser?.email?.split('@')[0],
      email: authUser?.email,
      role: p.role || 'user',
      dataCadastro: authUser?.created_at?.split('T')[0]
    };
  });

  return NextResponse.json(usuarios || []);
}

export async function PUT(req: NextRequest) {
  const { token, userId, role } = await req.json();
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 });
  }
  const { error } = await getSupabase()
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { token, userId } = await req.json();
  if (!token || !(await isAdmin(token))) {
    return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 });
  }
  const { error } = await getSupabase().auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}