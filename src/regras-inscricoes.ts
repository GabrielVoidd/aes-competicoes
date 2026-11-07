import type { Competicao } from './banco'

export const vinculos = ['Da unidade', 'De outra unidade', 'Pai/mãe de sócio', 'Filho dependente', 'Cônjuge de associado', 'Agregado aposentado', 'Agregado ex-funcionário'] as const
export type Atleta = {
  id: string; equipeId: string; nome: string; anoNascimento: number
  tipoDocumento: 'NIF' | 'RG' | 'CPF'; documento: string
  vinculo: typeof vinculos[number]; unidadeOrigem: string
  associadoNome: string; associadoIdentificacao: string; ativo: boolean
}
export type Responsavel = { equipeId: string; nome: string; telefone: string; email: string }
export type Inscricoes = {
  anoReferencia: number; limitePorEquipe: number; idadeMinima: number
  atletas: Atleta[]; responsaveis: Responsavel[]
}
export function exigeAssociado(vinculo: string): boolean {
  return ['Pai/mãe de sócio', 'Filho dependente', 'Cônjuge de associado'].includes(vinculo)
}
const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const texto = (v: unknown, max: number, obrigatorio = true): v is string => typeof v === 'string' && v.length <= max && (!obrigatorio || v.trim().length > 0)
const inteiro = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max
export const normalizarDocumento = (v: string): string => v.normalize('NFKC').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

// A mesma validação é aplicada na tela, na transação e na importação.
export function validarInscricoes(valor: unknown, competicao: Competicao): asserts valor is Inscricoes {
  if (!objeto(valor) || !inteiro(valor.anoReferencia, 1900, 9999)
    || !inteiro(valor.limitePorEquipe, 1, 999) || !inteiro(valor.idadeMinima, 0, 120)
    || !Array.isArray(valor.atletas) || !Array.isArray(valor.responsaveis)) {
    throw new Error('Confira ano de referência, limite por equipe e idade mínima.')
  }
  if (competicao.modalidade !== 'Futsal') throw new Error('Inscrições disponíveis nesta etapa para futsal.')
  if (/master/i.test(competicao.categoria) && valor.idadeMinima < 40) throw new Error('A categoria Master exige idade mínima de 40 anos.')
  const equipes = new Set((competicao.equipes ?? []).map(e => e.id))
  const ids = new Set<string>(); const documentos = new Set<string>(); const totais = new Map<string, number>()
  for (const a of valor.atletas) {
    if (!objeto(a) || !texto(a.id, 100) || ids.has(a.id) || !texto(a.equipeId, 100) || !equipes.has(a.equipeId)
      || !texto(a.nome, 120) || !inteiro(a.anoNascimento, 1900, valor.anoReferencia)
      || !['NIF', 'RG', 'CPF'].includes(String(a.tipoDocumento)) || !texto(a.documento, 40)
      || !normalizarDocumento(a.documento) || !vinculos.some(v => v === a.vinculo)
      || !texto(a.unidadeOrigem, 40, false) || !texto(a.associadoNome, 120, false)
      || !texto(a.associadoIdentificacao, 40, false) || typeof a.ativo !== 'boolean') {
      throw new Error('Existe atleta com campos inválidos ou equipe inexistente.')
    }
    ids.add(a.id)
    if (a.vinculo === 'De outra unidade' && !a.unidadeOrigem.trim()) throw new Error('Informe a unidade de origem do atleta.')
    if (exigeAssociado(String(a.vinculo)) && (!a.associadoNome.trim() || !normalizarDocumento(a.associadoIdentificacao))) throw new Error('Informe nome e identificação do associado relacionado.')
    if (!a.ativo) continue
    if (valor.anoReferencia - a.anoNascimento < valor.idadeMinima) throw new Error(`${a.nome}: idade abaixo do mínimo de ${valor.idadeMinima} anos no ano de referência.`)
    const chave = `${a.tipoDocumento}:${normalizarDocumento(a.documento)}`
    if (documentos.has(chave)) throw new Error(`${a.nome}: esse documento já possui inscrição ativa nesta competição.`)
    documentos.add(chave)
    const total = (totais.get(a.equipeId) ?? 0) + 1
    if (total > valor.limitePorEquipe) throw new Error(`Uma equipe ultrapassa o limite de ${valor.limitePorEquipe} atletas ativos. Cancele inscrições antes de reduzir o limite.`)
    totais.set(a.equipeId, total)
  }
  const contatos = new Set<string>()
  for (const r of valor.responsaveis) {
    if (!objeto(r) || !texto(r.equipeId, 100) || !equipes.has(r.equipeId) || contatos.has(r.equipeId)
      || !texto(r.nome, 120) || !texto(r.telefone, 60) || !texto(r.email, 160)
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) throw new Error('Confira nome, telefone/ramal e e-mail do responsável.')
    contatos.add(r.equipeId)
  }
}
export function inscricoesValidas(valor: unknown, competicao: Competicao): boolean {
  if (valor === undefined) return true
  try { validarInscricoes(valor, competicao); return true } catch { return false }
}
export function copiarInscricoes(i: Inscricoes): Inscricoes {
  return {
    anoReferencia: i.anoReferencia, limitePorEquipe: i.limitePorEquipe, idadeMinima: i.idadeMinima,
    atletas: i.atletas.map(a => ({ id: a.id, equipeId: a.equipeId, nome: a.nome, anoNascimento: a.anoNascimento,
      tipoDocumento: a.tipoDocumento, documento: a.documento, vinculo: a.vinculo, unidadeOrigem: a.unidadeOrigem,
      associadoNome: a.associadoNome, associadoIdentificacao: a.associadoIdentificacao, ativo: a.ativo })),
    responsaveis: i.responsaveis.map(r => ({ equipeId: r.equipeId, nome: r.nome, telefone: r.telefone, email: r.email })),
  }
}
