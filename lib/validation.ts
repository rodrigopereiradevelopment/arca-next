// Utilitários de sanitização e validação de inputs

/**
 * Remove caracteres perigosos de strings
 * Previne XSS e injection básica
 */
export function sanitizeString(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+\s*=/gi, '') // Remove onclick, onerror, etc.
    .trim();
}

/**
 * Sanitiza email
 */
export function sanitizeEmail(email: string | undefined | null): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Valida formato de email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida CPF (apenas dígitos)
 */
export function sanitizeCpf(cpf: string | undefined | null): string {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '').slice(0, 11);
}

/**
 * Valida telefone (apenas dígitos)
 */
export function sanitizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(0, 11);
}

/**
 * Valida CEP (apenas dígitos)
 */
export function sanitizeCep(cep: string | undefined | null): string {
  if (!cep) return '';
  return cep.replace(/\D/g, '').slice(0, 8);
}

/**
 * Sanitiza nome (remove caracteres especiais perigosos)
 */
export function sanitizeName(name: string | undefined | null): string {
  if (!name) return '';
  return name
    .replace(/[<>]/g, '')
    .replace(/[;'"\\]/g, '')
    .trim()
    .slice(0, 100); // Limita tamanho
}

/**
 * Sanitiza endereço
 */
export function sanitizeAddress(address: string | undefined | null): string {
  if (!address) return '';
  return address
    .replace(/[<>]/g, '')
    .replace(/[;'"\\]/g, '')
    .trim()
    .slice(0, 200);
}

/**
 * Sanitiza número (CEP, número de endereço)
 */
export function sanitizeNumber(number: string | undefined | null): string {
  if (!number) return '';
  return number.replace(/[^\d\-]/g, '').slice(0, 20);
}

/**
 * Valida se uma string não está vazia
 */
export function required(value: string, fieldName: string): string | null {
  if (!value || value.trim().length === 0) {
    return `${fieldName} é obrigatório`;
  }
  return null;
}

/**
 * Valida tamanho mínimo
 */
export function minLength(value: string, min: number, fieldName: string): string | null {
  if (value && value.length < min) {
    return `${fieldName} deve ter pelo menos ${min} caracteres`;
  }
  return null;
}

/**
 * Valida tamanho máximo
 */
export function maxLength(value: string, max: number, fieldName: string): string | null {
  if (value && value.length > max) {
    return `${fieldName} deve ter no máximo ${max} caracteres`;
  }
  return null;
}

/**
 * Sanitiza objeto de dados de cadastro
 */
export function sanitizeCadastro(data: any) {
  return {
    nome: sanitizeName(data.nome),
    email: sanitizeEmail(data.email),
    cpf: sanitizeCpf(data.cpf),
    telefone: sanitizePhone(data.telefone),
    cidade: sanitizeAddress(data.cidade),
    estado: sanitizeString(data.estado),
  };
}

/**
 * Sanitiza objeto de endereço
 */
export function sanitizeEndereco(data: any) {
  return {
    apelido: sanitizeName(data.apelido),
    cep: sanitizeCep(data.cep),
    rua: sanitizeAddress(data.rua),
    numero: sanitizeNumber(data.numero),
    complemento: sanitizeAddress(data.complemento),
    bairro: sanitizeAddress(data.bairro),
    cidade: sanitizeAddress(data.cidade),
    estado: sanitizeString(data.estado),
  };
}

/**
 * Sanitiza objeto de perfil
 */
export function sanitizePerfil(data: any) {
  return {
    nome: sanitizeName(data.nome),
    telefone: sanitizePhone(data.telefone),
    cidade: sanitizeAddress(data.cidade),
    cpf: sanitizeCpf(data.cpf),
    estado: sanitizeString(data.estado),
    raio_busca: typeof data.raio_busca === 'number' ? Math.min(Math.max(data.raio_busca, 1), 30) : 10,
  };
}

/**
 * Valida payload de cadastro
 */
export function validateCadastro(data: any): string[] {
  const errors: string[] = [];
  
  const nomeError = required(data.nome, 'Nome');
  if (nomeError) errors.push(nomeError);
  
  const emailError = required(data.email, 'Email');
  if (emailError) errors.push(emailError);
  else if (!isValidEmail(data.email)) errors.push('Email inválido');
  
  const senhaError = required(data.senha, 'Senha');
  if (senhaError) errors.push(senhaError);
  else if (data.senha.length < 8) errors.push('Senha deve ter pelo menos 8 caracteres');
  
  return errors;
}

/**
 * Valida payload de endereço
 */
export function validateEndereco(data: any): string[] {
  const errors: string[] = [];
  
  const apelidoError = required(data.apelido, 'Apelido');
  if (apelidoError) errors.push(apelidoError);
  
  const ruaError = required(data.rua, 'Rua');
  if (ruaError) errors.push(ruaError);
  
  return errors;
}
