// Audit log para tentativas suspeitas
// Por enquanto loga no console, pode ser estendido para salvar no banco

interface AuditEvent {
  tipo: 'LOGIN_FALHA' | 'ACESSO_NAO_AUTORIZADO' | 'RATE_LIMIT' | 'PAYLOAD_GRANDE' | 'INPUT_INVALIDO';
  ip: string;
  email?: string;
  rota: string;
  detalhes?: string;
  timestamp: string;
}

class AuditLogger {
  private events: AuditEvent[] = [];
  private maxEvents = 1000; // Mantém apenas os últimos 1000 eventos em memória

  log(event: Omit<AuditEvent, 'timestamp'>) {
    const entry: AuditEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Log no console para debugging
    console.log(`[AUDIT] ${entry.tipo}:`, {
      ip: entry.ip,
      email: entry.email,
      rota: entry.rota,
      detalhes: entry.detalhes,
      timestamp: entry.timestamp,
    });

    // Armazena em memória (pode ser estendido para banco)
    this.events.push(entry);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  getRecentEvents(limit = 50): AuditEvent[] {
    return this.events.slice(-limit);
  }

  getEventsByType(type: AuditEvent['tipo'], limit = 50): AuditEvent[] {
    return this.events.filter(e => e.tipo === type).slice(-limit);
  }

  getEventsByIp(ip: string, limit = 50): AuditEvent[] {
    return this.events.filter(e => e.ip === ip).slice(-limit);
  }

  // Detecta tentativas suspeitas (múltiplas falhas do mesmo IP)
  detectSuspiciousActivity(ip: string, windowMinutes = 15): boolean {
    const now = Date.now();
    const window = windowMinutes * 60 * 1000;
    const recentFailures = this.events.filter(
      e => e.ip === ip && 
           (e.tipo === 'LOGIN_FALHA' || e.tipo === 'ACESSO_NAO_AUTORIZADO') &&
           now - new Date(e.timestamp).getTime() < window
    );
    return recentFailures.length >= 5; // 5 ou mais falhas em 15 minutos
  }
}

// Singleton
export const auditLogger = new AuditLogger();

// Funções auxiliares
export function logLoginFailure(ip: string, email: string, rota: string, detalhes?: string) {
  auditLogger.log({ tipo: 'LOGIN_FALHA', ip, email, rota, detalhes });
}

export function logUnauthorizedAccess(ip: string, rota: string, detalhes?: string) {
  auditLogger.log({ tipo: 'ACESSO_NAO_AUTORIZADO', ip, rota, detalhes });
}

export function logRateLimit(ip: string, rota: string) {
  auditLogger.log({ tipo: 'RATE_LIMIT', ip, rota });
}

export function logPayloadTooLarge(ip: string, rota: string, tamanho: number) {
  auditLogger.log({ tipo: 'PAYLOAD_GRANDE', ip, rota, detalhes: `Tamanho: ${tamanho}` });
}

export function logInvalidInput(ip: string, rota: string, campo: string) {
  auditLogger.log({ tipo: 'INPUT_INVALIDO', ip, rota, detalhes: `Campo inválido: ${campo}` });
}
