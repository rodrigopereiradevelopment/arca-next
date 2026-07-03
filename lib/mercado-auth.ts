import { getSupabaseServerClient } from "@/lib/db/supabase";

export interface MercadoAdminInfo {
  userId: string;
  mercadoId: number;
  role: string;
}

export async function getMercadoAdmin(token: string): Promise<MercadoAdminInfo | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, mercado_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "mercado_admin" || !profile.mercado_id) {
      return null;
    }

    return { userId: user.id, mercadoId: profile.mercado_id, role: profile.role };
  } catch {
    return null;
  }
}
