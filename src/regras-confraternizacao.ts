import { atletasDamas, classificadosRegional } from './regras-damas'
import type { Competicao } from './banco'
import { situacaoColonia } from './regras-participacoes'
export const categoriasFesta = ['Atleta', 'Dependente/acompanhante', 'Sócio', 'Convidado'] as const
export const faixasFesta = ['Até 6 anos', '7 a 10 anos', '11 anos ou mais'] as const
export type PessoaFesta = { id: string; nome: string; documento: string; escola: string; categoria: typeof categoriasFesta[number]; faixa: typeof faixasFesta[number]; atletaId: string; ativo: boolean }
export type EtapaFesta = 'regional' | 'final'
export type Festa = { precos: (number | null)[]; pessoas: PessoaFesta[] }
export type Confraternizacao = { regional: Festa; final: Festa }
export function festaVazia(): Confraternizacao { return { regional: { precos: Array(12).fill(null), pessoas: [] }, final: { precos: Array(12).fill(null), pessoas: [] } } }
export function indicePreco(p: PessoaFesta): number { return categoriasFesta.indexOf(p.categoria) * 3 + faixasFesta.indexOf(p.faixa) }
export function valorPessoa(f: Festa, p: PessoaFesta): number | null { return f.precos[indicePreco(p)] ?? null }
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const txt = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max
export function validarConfraternizacao(v: unknown, c: Competicao): asserts v is Confraternizacao {
  if (!obj(v)) throw new Error('Confraternização inválida.')
  for (const etapa of ['regional', 'final'] as const) {
    const f = v[etapa]
    if (!obj(f) || !Array.isArray(f.precos) || f.precos.length !== 12 || !f.precos.every(x => x === null || (Number.isSafeInteger(x) && x >= 0 && x <= 100000000)) || !Array.isArray(f.pessoas)) throw new Error('Confira os preços da confraternização.')
    const ids = new Set<string>(), docs = new Set<string>(), atletas = new Set<string>()
    for (const p of f.pessoas) {
      if (!obj(p) || !txt(p.id, 100) || ids.has(p.id) || !txt(p.nome, 120) || !txt(p.documento, 50) || !txt(p.escola, 40) || !categoriasFesta.some(x => x === p.categoria) || !faixasFesta.some(x => x === p.faixa) || typeof p.atletaId !== 'string' || typeof p.ativo !== 'boolean') throw new Error('Confira nome, documento, escola, categoria e faixa etária.')
      ids.add(p.id)
      const doc = p.documento.normalize('NFKC').replace(/[^a-z0-9]/gi, '').toUpperCase()
      if (!doc) throw new Error('Informe um documento válido.')
      if (p.ativo && docs.has(doc)) throw new Error('Esse documento já está inscrito nesta etapa.')
      if (p.ativo) docs.add(doc)
      if (p.categoria === 'Atleta') {
        const a = c.modalidade === 'Damas' ? atletasDamas(c).find(a => a.id === p.atletaId) : c.inscricoes?.atletas.find(a => a.id === p.atletaId)
        if (!a) throw new Error('Selecione um atleta cadastrado.')
        if (p.ativo && atletas.has(p.atletaId)) throw new Error('Atleta já inscrito nesta etapa.')
        if (p.ativo) atletas.add(p.atletaId)
      } else if (p.atletaId !== '') throw new Error('Somente a categoria Atleta pode representar uma inscrição esportiva.')
    }
  }
}
export function confraternizacaoValida(v: unknown, c: Competicao): boolean { if (v === undefined) return true; try { validarConfraternizacao(v, c); return true } catch { return false } }
export function copiarConfraternizacao(v: Confraternizacao): Confraternizacao {
  function etapa(f: Festa): Festa { return { precos: [...f.precos], pessoas: f.pessoas.map(p => ({ id: p.id, nome: p.nome, documento: p.documento, escola: p.escola, categoria: p.categoria, faixa: p.faixa, atletaId: p.atletaId, ativo: p.ativo })) } }
  return { regional: etapa(v.regional), final: etapa(v.final) }
}
export function direitoHospedagem(c: Competicao, p: PessoaFesta): string {
  if (!p.ativo) return 'Inscrição cancelada'
  if (p.categoria !== 'Atleta') return 'Sem direito a quarto'
  if (c.modalidade === 'Damas') {
    const a = atletasDamas(c).find(a => a.id === p.atletaId)
    if (!a || !a.ativo) return 'Sem liberação: inscrição esportiva inativa ou inexistente'
    return (c.damasRegional ? classificadosRegional(c).includes(a.id) : a.classificado) ? 'Direito à hospedagem — classificação confirmada; quarto ainda não atribuído' : 'Sem liberação: classificação para a colônia não confirmada'
  }
  const a = c.inscricoes?.atletas.find(a => a.id === p.atletaId)
  if (!a) return 'Atleta não encontrado'
  if (c.modalidade !== 'Futsal') return 'Classificação desta modalidade ainda não disponível'
  const situacao = situacaoColonia(c, a)
  return situacao.apto ? 'Direito à hospedagem — quarto ainda não atribuído' : `Sem liberação: ${situacao.motivo}`
}
