import { NextRequest, NextResponse } from 'next/server';
import { logRateLimit } from '@/lib/audit';

// Rate limiting simples com Map em memória
// Cada IP tem uma janela de 60 segundos com limite de requisições
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Configurações por rota
const RATE_LIMITS: Record<string, { max: number; window: number }> = {
  '/api/auth/login': { max: 5, window: 60 },        // 5 tentativas/min
  '/api/auth/cadastro': { max: 3, window: 60 },      // 3 cadastros/min
  '/api/auth/esqueci-senha': { max: 3, window: 60 }, // 3 emails/min
  '/api/auth/redefinir-senha': { max: 5, window: 60 },
  '/api/comparar': { max: 10, window: 60 },          // 10 comparações/min
  '/api/upload': { max: 5, window: 60 },             // 5 uploads/min
  '/api/chat': { max: 10, window: 60 },              // 10 chats/min
  '/api/default': { max: 60, window: 60 },            // 60 req/min para outras rotas
};

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

function getRateLimitConfig(pathname: string) {
  // Match exato primeiro
  if (RATE_LIMITS[pathname]) return RATE_LIMITS[pathname];
  
  // Match por prefixo
  for (const [prefix, config] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) return config;
  }
  
  return RATE_LIMITS['/api/default'];
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; remaining: number; resetIn: number } {
  const config = getRateLimitConfig(pathname);
  const now = Date.now();
  const key = `${ip}:${pathname}`;
  
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetTime) {
    // Nova janela
    rateLimitMap.set(key, { count: 1, resetTime: now + config.window * 1000 });
    return { allowed: true, remaining: config.max - 1, resetIn: config.window };
  }
  
  if (entry.count >= config.max) {
    // Limite excedido
    const resetIn = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  // Incrementa contador
  entry.count++;
  return { allowed: true, remaining: config.max - entry.count, resetIn: Math.ceil((entry.resetTime - now) / 1000) };
}

// Limpa entries antigos a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Só aplica rate limiting em rotas /api
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Skip health check
  if (pathname === '/api/health') {
    return NextResponse.next();
  }
  
  const ip = getClientIp(request);
  const { allowed, remaining, resetIn } = checkRateLimit(ip, pathname);
  
  if (!allowed) {
    // Log tentativa de rate limit
    logRateLimit(ip, pathname);
    
    return NextResponse.json(
      { 
        erro: 'Muitas requisições. Tente novamente em alguns segundos.',
        retryAfter: resetIn 
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMITS['/api/default'].max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetIn),
          'Retry-After': String(resetIn),
        }
      }
    );
  }
  
  // Headers de info (opcional, útil para debug)
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
