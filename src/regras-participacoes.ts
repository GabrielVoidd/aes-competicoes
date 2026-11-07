import type { Competicao } from './banco'
import type { Atleta } from './regras-inscricoes'
import { participantesDoJogo, resultadosValidos } from './futsal'
import { resultadosRegionaisValidos, vencedorRegional } from './regras-regionais'

export type PartidaParticipacao = { chave: string; titulo: string; equipe1: string; equipe2: string }
export type Atuacao = { partida: string; equipe1: string; equipe2: string; atletas: string[]; atualizadaEm: string }
export type ExcecaoColonia = { atletaId: string; motivo: 'medico' | 'trabalho'; justificativa: string; responsavel: string; ativa: boolean; atualizadaEm: string }
export type Participacoes = { atuacoes: Atuacao[]; excecoes: ExcecaoColonia[] }

// A lista inclui somente jogos com resultado salvo e participantes definidos.
export function partidasParaParticipacao(c: Competicao): PartidaParticipacao[] {
  if (c.modalidade !== 'Futsal' || !resultadosValidos(c.resultados, c.grupos)
    || !resultadosRegionaisValidos(c.resultadosRegionais, c)) throw new Error('Confira os resultados da competição antes de registrar participações.')
  const partidas: PartidaParticipacao[] = []
  for (const r of [...(c.resultados ?? [])].sort((a, b) => a.grupo - b.grupo || a.jogo - b.jogo)) {
    const ids = r.grupo === 1 ? c.grupos?.grupo1 : c.grupos?.grupo2
    if (!ids) throw new Error('Grupo não encontrado.')
    const [equipe1, equipe2] = participantesDoJogo(ids, c.resultados ?? [], r.grupo, r.jogo)
    if (!equipe1 || !equipe2) throw new Error('Partida sem equipes definidas.')
    partidas.push({ chave: `grupo-${r.grupo}-${r.jogo}`, titulo: `Grupo ${r.grupo} · Jogo ${r.jogo}`, equipe1, equipe2 })
  }
  for (const r of [...(c.resultadosRegionais ?? [])].sort((a, b) => a.jogo - b.jogo)) {
    partidas.push({ chave: `regional-${r.jogo}`, titulo: `Regional · Jogo ${r.jogo}`, equipe1: r.equipe1, equipe2: r.equipe2 })
  }
  return partidas
}
const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const texto = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const data = (v: unknown): v is string => texto(v, 40) && !Number.isNaN(Date.parse(v))
export function validarParticipacoes(valor: unknown, c: Competicao): asserts valor is Participacoes {
  if (!objeto(valor) || !Array.isArray(valor.atuacoes) || !Array.isArray(valor.excecoes)) throw new Error('Dados de participação inválidos.')
  const partidas = partidasParaParticipacao(c)
  const atletas = new Map((c.inscricoes?.atletas ?? []).map(a => [a.id, a]))
  const chaves = new Set<string>()
  for (const r of valor.atuacoes) {
    if (!objeto(r) || !texto(r.partida, 40) || chaves.has(r.partida) || !Array.isArray(r.atletas)
      || new Set(r.atletas).size !== r.atletas.length || !data(r.atualizadaEm)) throw new Error('Registro de atuação inválido ou repetido.')
    const partida = partidas.find(p => p.chave === r.partida)
    if (!partida || r.equipe1 !== partida.equipe1 || r.equipe2 !== partida.equipe2) throw new Error('Uma partida registrada teve seus participantes alterados.')
    for (const id of r.atletas) {
      const a = typeof id === 'string' ? atletas.get(id) : undefined
      if (!a || (a.equipeId !== partida.equipe1 && a.equipeId !== partida.equipe2)) throw new Error('Há atleta inexistente ou de outra equipe na participação.')
    }
    chaves.add(r.partida)
  }
  const excecoes = new Set<string>()
  for (const e of valor.excecoes) {
    if (!objeto(e) || !texto(e.atletaId, 100) || !atletas.has(e.atletaId) || excecoes.has(e.atletaId)
      || (e.motivo !== 'medico' && e.motivo !== 'trabalho') || !texto(e.justificativa, 1000)
      || !texto(e.responsavel, 120) || typeof e.ativa !== 'boolean' || !data(e.atualizadaEm)) throw new Error('Confira o atleta, motivo, justificativa e responsável pela exceção.')
    excecoes.add(e.atletaId)
  }
}
export function participacoesValidas(valor: unknown, c: Competicao): boolean {
  if (valor === undefined) return true
  try { validarParticipacoes(valor, c); return true } catch { return false }
}
export function copiarParticipacoes(p: Participacoes): Participacoes {
  return {
    atuacoes: p.atuacoes.map(a => ({ partida: a.partida, equipe1: a.equipe1, equipe2: a.equipe2, atletas: [...a.atletas], atualizadaEm: a.atualizadaEm })),
    excecoes: p.excecoes.map(e => ({ atletaId: e.atletaId, motivo: e.motivo, justificativa: e.justificativa, responsavel: e.responsavel, ativa: e.ativa, atualizadaEm: e.atualizadaEm })),
  }
}
export function situacaoColonia(c: Competicao, atleta: Atleta): { apto: boolean; motivo: string; jogos: string[] } {
  const jogos = (c.participacoes?.atuacoes ?? []).filter(a => a.atletas.includes(atleta.id)).map(a => a.partida)
  const resposta = (motivo: string, apto = false) => ({ apto, motivo, jogos })
  if (!atleta.ativo) return resposta('Inscrição cancelada')
  const regionais = c.resultadosRegionais ?? []
  const classificada = regionais.some(r => vencedorRegional(r) === atleta.equipeId)
  if (!classificada) {
    const perdeu = regionais.some(r => (r.equipe1 === atleta.equipeId || r.equipe2 === atleta.equipeId) && vencedorRegional(r) !== atleta.equipeId)
    return resposta(perdeu || regionais.length === 4 ? 'Equipe não classificada para a colônia' : 'Aguardando classificação da equipe')
  }
  if (jogos.length > 0) return resposta('Apto por atuação registrada', true)
  const excecao = c.participacoes?.excecoes.find(e => e.atletaId === atleta.id && e.ativa)
  if (excecao) return resposta(excecao.motivo === 'medico' ? 'Apto por exceção médica' : 'Apto por exceção de trabalho', true)
  return resposta('Pendente: sem atuação registrada ou exceção ativa')
}
