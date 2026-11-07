import type { Competicao } from './banco'
import { exigeAssociado, normalizarDocumento, vinculos } from './regras-inscricoes'

export const vinculosDamas = ['Sócio/funcionário', ...vinculos] as const
export type Damista = {
  id: string; nome: string; escola: string; anoNascimento: number
  tipoDocumento: 'NIF' | 'RG' | 'CPF'; documento: string
  vinculo: typeof vinculosDamas[number]; associadoNome: string; associadoIdentificacao: string
  ativo: boolean; classificado: boolean
}
export type PartidaDamas = { vencedor: 'a' | 'b' | 'empate'; pecasA: number; pecasB: number; brancas: 'a' | 'b' | '' }
export type ConfrontoDamas = { a: string; b: string; partidas: PartidaDamas[]; extras: PartidaDamas[] }
export type DesempateDamas = {
  participantes: string[]; jogos: { a: string; b: string; partida: PartidaDamas }[]
  ordem: string[]; responsavel: string; observacao: string
}
export type Damas = { participantes: Damista[]; ordem: string[]; resultados: ConfrontoDamas[]; desempates: DesempateDamas[]; encerrada: boolean }
export type LinhaDamas = { id: string; confrontos: number; vitorias: number; pecas: number; partidas: number }
export const damasVazia = (): Damas => ({ participantes: [], ordem: [], resultados: [], desempates: [], encerrada: false })
export function copiarDamas(d: Damas): Damas {
  const partida = (p: PartidaDamas): PartidaDamas => ({ vencedor: p.vencedor, pecasA: p.pecasA, pecasB: p.pecasB, brancas: p.brancas })
  return {
    participantes: d.participantes.map(p => ({ id: p.id, nome: p.nome, escola: p.escola, anoNascimento: p.anoNascimento, tipoDocumento: p.tipoDocumento, documento: p.documento, vinculo: p.vinculo, associadoNome: p.associadoNome, associadoIdentificacao: p.associadoIdentificacao, ativo: p.ativo, classificado: p.classificado })),
    ordem: [...d.ordem], resultados: d.resultados.map(r => ({ a: r.a, b: r.b, partidas: r.partidas.map(partida), extras: r.extras.map(partida) })),
    desempates: d.desempates.map(t => ({ participantes: [...t.participantes], jogos: t.jogos.map(j => ({ a: j.a, b: j.b, partida: partida(j.partida) })), ordem: [...t.ordem], responsavel: t.responsavel, observacao: t.observacao })), encerrada: d.encerrada,
  }
}
// Método circular: cada par joga uma vez; quantidade ímpar deixa uma folga por rodada.
export function tabelaDamas(ordem: string[]): { rodada: number; a: string; b: string }[] {
  if (ordem.length < 2) return []
  const giro: (string | null)[] = [...ordem]
  if (giro.length % 2) giro.push(null)
  const tabela: { rodada: number; a: string; b: string }[] = []
  for (let rodada = 1; rodada < giro.length; rodada++) {
    for (let i = 0; i < giro.length / 2; i++) {
      const a = giro[i], b = giro[giro.length - 1 - i]
      if (a && b) tabela.push({ rodada, a, b })
    }
    giro.splice(1, 0, giro.pop()!)
  }
  return tabela
}
export function resumoConfronto(r: ConfrontoDamas): { vencedor: 'a' | 'b' | null; motivo: string; pecasA: number; pecasB: number; vitoriasA: number; vitoriasB: number } {
  const pecasA = r.partidas.reduce((s, p) => s + p.pecasA, 0), pecasB = r.partidas.reduce((s, p) => s + p.pecasB, 0)
  const vitoriasA = r.partidas.filter(p => p.vencedor === 'a').length, vitoriasB = r.partidas.filter(p => p.vencedor === 'b').length
  const base = { pecasA, pecasB, vitoriasA, vitoriasB }
  if (r.partidas.length !== 3) return { ...base, vencedor: null, motivo: `Aguardando ${3 - r.partidas.length} partida(s)` }
  if (vitoriasA !== vitoriasB) return { ...base, vencedor: vitoriasA > vitoriasB ? 'a' : 'b', motivo: 'Vitórias nas três partidas' }
  if (pecasA !== pecasB) return { ...base, vencedor: pecasA > pecasB ? 'a' : 'b', motivo: 'Soma das peças nas três partidas' }
  const decisiva = r.extras.find(p => p.vencedor !== 'empate')
  return { ...base, vencedor: decisiva ? decisiva.vencedor as 'a' | 'b' : null, motivo: decisiva ? 'Vitória em jogo extra' : 'Empate em vitórias e peças: registrar jogo extra' }
}
export function compararDamas(a: LinhaDamas, b: LinhaDamas): number { return b.vitorias - a.vitorias || b.pecas - a.pecas }
export function classificacaoDamas(d: Damas): LinhaDamas[] {
  const linhas = d.ordem.map(id => ({ id, confrontos: 0, vitorias: 0, pecas: 0, partidas: 0 }))
  const porId = new Map(linhas.map(l => [l.id, l]))
  for (const r of d.resultados) {
    const a = porId.get(r.a), b = porId.get(r.b)
    if (!a || !b) continue
    const resumo = resumoConfronto(r)
    a.pecas += resumo.pecasA; b.pecas += resumo.pecasB
    a.partidas += r.partidas.length; b.partidas += r.partidas.length
    if (resumo.vencedor) { a.confrontos++; b.confrontos++; if (resumo.vencedor === 'a') a.vitorias++; else b.vitorias++ }
  }
  return linhas.sort(compararDamas)
}
export function todosConcluidos(d: Damas): boolean {
  const tabela = tabelaDamas(d.ordem)
  return tabela.length > 0 && tabela.every(j => { const r = d.resultados.find(r => r.a === j.a && r.b === j.b); return r && resumoConfronto(r).vencedor !== null })
}
export function empatesDamas(d: Damas): string[][] {
  const grupos: LinhaDamas[][] = []
  for (const linha of classificacaoDamas(d)) { const ultimo = grupos.at(-1); if (ultimo?.[0] && compararDamas(ultimo[0], linha) === 0) ultimo.push(linha); else grupos.push([linha]) }
  return grupos.filter(g => g.length > 1).map(g => g.map(l => l.id))
}
export function mesmosIds(a: string[], b: string[]): boolean { return a.length === b.length && new Set(a).size === a.length && a.every(id => b.includes(id)) }
export function classificacaoFinalDamas(d: Damas): LinhaDamas[] {
  return classificacaoDamas(d).sort((a, b) => {
    const diferenca = compararDamas(a, b)
    if (diferenca) return diferenca
    const desempate = d.desempates.find(t => t.ordem.includes(a.id) && t.ordem.includes(b.id))
    return desempate ? desempate.ordem.indexOf(a.id) - desempate.ordem.indexOf(b.id) : 0
  })
}
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const texto = (v: unknown, max: number, obrigatorio = true): v is string => typeof v === 'string' && v.length <= max && (!obrigatorio || v.trim().length > 0)
const inteiro = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max
function validarPartida(p: unknown): asserts p is PartidaDamas {
  if (!obj(p) || (typeof p.vencedor !== 'string' || !['a', 'b', 'empate'].includes(p.vencedor)) || !inteiro(p.pecasA, 0, 12) || !inteiro(p.pecasB, 0, 12) || (typeof p.brancas !== 'string' || !['a', 'b', ''].includes(p.brancas))) throw new Error('Informe resultado e peças inteiras de 0 a 12 para os dois jogadores.')
  if ((p.vencedor !== 'b' && p.pecasA === 0) || (p.vencedor !== 'a' && p.pecasB === 0)) throw new Error('Vencedor precisa ter ao menos uma peça; empate exige peças dos dois lados.')
}
export function validarDamas(v: unknown, c: Competicao, regional = false): asserts v is Damas {
  if (c.modalidade !== 'Damas' || !obj(v) || !Array.isArray(v.participantes) || !Array.isArray(v.ordem) || !Array.isArray(v.resultados) || !Array.isArray(v.desempates) || typeof v.encerrada !== 'boolean') throw new Error('Dados de damas inválidos.')
  const ids = new Set<string>(), docs = new Set<string>()
  for (const p of v.participantes) {
    if (!obj(p) || !texto(p.id, 100) || ids.has(p.id) || !texto(p.nome, 120) || !texto(p.escola, 40) || !inteiro(p.anoNascimento, 1900, 9999) || (typeof p.tipoDocumento !== 'string' || !['NIF', 'RG', 'CPF'].includes(p.tipoDocumento)) || !texto(p.documento, 40) || !normalizarDocumento(p.documento) || !vinculosDamas.some(x => x === p.vinculo) || !texto(p.associadoNome, 120, false) || !texto(p.associadoIdentificacao, 40, false) || typeof p.ativo !== 'boolean' || typeof p.classificado !== 'boolean') throw new Error('Confira os dados do participante de damas.')
    ids.add(p.id)
    const ano = /^\d{4}$/.test(c.edicao) ? Number(c.edicao) : Number(c.data.slice(0, 4)) || new Date().getFullYear()
    if (p.anoNascimento > ano) throw new Error('O ano de nascimento não pode ser posterior ao ano da competição.')
    if (exigeAssociado(String(p.vinculo)) && (!p.associadoNome.trim() || !normalizarDocumento(p.associadoIdentificacao))) throw new Error('Informe o associado responsável e sua identificação para o vínculo familiar.')
    const doc = `${p.tipoDocumento}:${normalizarDocumento(p.documento)}`
    if (p.ativo && docs.has(doc)) throw new Error('Documento já cadastrado em uma inscrição ativa de damas.')
    if (p.ativo) docs.add(doc)
  }
  const participantes = v.participantes
  if (new Set(v.ordem).size !== v.ordem.length || !v.ordem.every(id => typeof id === 'string' && participantes.some(p => p.id === id && p.ativo && (regional || p.classificado))) || v.ordem.length === 1) throw new Error('A tabela deve conter ao menos dois atletas ativos e classificados, sem repetição.')
  const d = v as unknown as Damas, tabela = tabelaDamas(d.ordem), pares = new Set<string>()
  for (const r of v.resultados) {
    if (!obj(r) || !texto(r.a, 100) || !texto(r.b, 100) || !tabela.some(j => j.a === r.a && j.b === r.b) || !Array.isArray(r.partidas) || r.partidas.length > 3 || !Array.isArray(r.extras)) throw new Error('Resultado incompatível com a tabela de damas.')
    const chave = JSON.stringify([r.a, r.b]); if (pares.has(chave)) throw new Error('Confronto repetido.'); pares.add(chave)
    r.partidas.forEach(validarPartida)
    const base = resumoConfronto({ a: r.a, b: r.b, partidas: r.partidas, extras: [] })
    if (r.extras.length && (r.partidas.length !== 3 || base.vencedor !== null)) throw new Error('Jogo extra só é permitido após empate nas vitórias e nas peças das três partidas.')
    let decidiu = false
    for (const p of r.extras) { validarPartida(p); if (decidiu) throw new Error('Já existe um jogo extra decisivo neste confronto.'); decidiu = p.vencedor !== 'empate' }
  }
  if (d.desempates.length && !todosConcluidos(d)) throw new Error('Conclua todos os confrontos antes do desempate da classificação.')
  const empates = empatesDamas(d), usados = new Set<string>()
  for (const t of v.desempates) {
    if (!obj(t) || !Array.isArray(t.participantes) || !t.participantes.every(id => typeof id === 'string') || !empates.some(g => mesmosIds(g, t.participantes as string[])) || t.participantes.some(id => usados.has(id)) || !Array.isArray(t.ordem) || !t.ordem.every(id => typeof id === 'string') || !mesmosIds(t.participantes, t.ordem) || !texto(t.responsavel, 120) || !texto(t.observacao, 1000, false) || !Array.isArray(t.jogos) || !t.jogos.length) throw new Error('Confira o grupo empatado, os jogos extras, a ordem e o responsável pelo desempate.')
    const jogaram = new Set<string>()
    for (const j of t.jogos) {
      if (!obj(j) || typeof j.a !== 'string' || typeof j.b !== 'string' || j.a === j.b || !t.participantes.includes(j.a) || !t.participantes.includes(j.b)) throw new Error('Jogo de desempate com participantes inválidos.')
      validarPartida(j.partida); jogaram.add(j.a); jogaram.add(j.b)
    }
    if (jogaram.size !== t.participantes.length || !t.jogos.some(j => j.partida.vencedor !== 'empate')) throw new Error('Registre os jogos extras de todos os empatados e ao menos uma partida decisiva.')
    if (t.participantes.length === 2) {
      let vencedor: string | undefined
      for (const j of t.jogos) {
        if (vencedor) throw new Error('O desempate já foi decidido; remova jogos posteriores.')
        if (j.partida.vencedor !== 'empate') vencedor = j.partida.vencedor === 'a' ? j.a : j.b
      }
      if (!vencedor || t.ordem[0] !== vencedor) throw new Error('A ordem deve colocar o vencedor do jogo extra à frente.')
    } else if (!t.observacao.trim()) throw new Error('Para três ou mais empatados, descreva o formato e a decisão da organização.')
    t.participantes.forEach(id => usados.add(id))
  }
  if (d.encerrada && (!todosConcluidos(d) || empates.some(g => !d.desempates.some(t => mesmosIds(g, t.participantes))))) throw new Error('Conclua todos os confrontos e resolva os empates antes de encerrar.')
}
export function damasValidas(v: unknown, c: Competicao, regional = false): boolean { if (v === undefined) return true; try { validarDamas(v, c, regional); return true } catch { return false } }

export function classificadosRegional(c: Competicao): string[] {
  const r = c.damasRegional
  if (!r?.encerrada || !damasValidas(r, c, true)) return []
  return classificacaoFinalDamas(r).slice(0, 2).map(l => l.id)
}
export function etapasDamasValidas(c: Competicao): boolean {
  if (!damasValidas(c.damasRegional, c, true)) return false
  if (c.damasFinalDaRegional !== undefined && typeof c.damasFinalDaRegional !== 'boolean') return false
  if (!c.damasFinalDaRegional) return true
  const ids = classificadosRegional(c)
  return ids.length === 2 && !!c.damas && mesmosIds(ids, c.damas.ordem)
    && mesmosIds(ids, c.damas.participantes.map(p => p.id))
    && c.damas.participantes.every(p => p.ativo && p.classificado)
}
export function atletasDamas(c: Competicao): Damista[] {
  const mapa = new Map((c.damasRegional?.participantes ?? []).map(p => [p.id, p]))
  for (const p of c.damas?.participantes ?? []) mapa.set(p.id, p)
  return [...mapa.values()]
}
