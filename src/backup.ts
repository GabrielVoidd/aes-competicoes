import { damasValidas, copiarDamas, etapasDamasValidas } from './regras-damas'
import { confraternizacaoValida, copiarConfraternizacao } from './regras-confraternizacao'
import { participacoesValidas, copiarParticipacoes } from './regras-participacoes'
import { inscricoesValidas, copiarInscricoes } from './regras-inscricoes'
import {
  resultadosRegionaisValidos,
  sorteioColoniaValido,
  resultadosColoniaValidos,
} from './regras-regionais'
import { resultadosValidos } from './futsal'
import type { GruposFutsal } from './banco'
import { modalidades, listarCompeticoes } from './banco'
import type { Competicao, Equipe } from './banco'

type Backup = {
  aplicativo: 'aes-competicoes'
  versao: 13
  exportadoEm: string
  competicoes: Competicao[]
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function texto(
  valor: unknown,
  limite: number,
  obrigatorio = true,
): valor is string {
  return typeof valor === 'string'
    && valor.length <= limite
    && (!obrigatorio || valor.trim().length > 0)
}

function dataValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false

  const data = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(data.getTime())
    && data.toISOString().slice(0, 10) === valor
}

function equipesValidas(valor: unknown): valor is Equipe[] | undefined {
  if (valor === undefined) return true
  if (!Array.isArray(valor)) return false

  const ids = new Set<string>()

  for (const equipe of valor) {
    if (
      !objeto(equipe)
      || !texto(equipe.id, 100)
      || !texto(equipe.nome, 100)
      || !texto(equipe.unidade, 40)
      || ids.has(equipe.id)
    ) {
      return false
    }

    ids.add(equipe.id)
  }

  return true
}

function gruposValidos(
  valor: unknown,
  equipes: Equipe[] | undefined,
): boolean {
  if (valor === undefined) return true
  if (!objeto(valor) || !equipes || equipes.length !== 10) return false

  if (
    !Array.isArray(valor.grupo1)
    || !Array.isArray(valor.grupo2)
    || valor.grupo1.length !== 5
    || valor.grupo2.length !== 5
  ) {
    return false
  }

  const ids: unknown[] = [...valor.grupo1, ...valor.grupo2]
  const inscritos = new Set(equipes.map(equipe => equipe.id))

  return new Set(ids).size === 10
    && ids.every(id => typeof id === 'string' && inscritos.has(id))
}

function desempatesValidos(
  valor: unknown,
  grupos: GruposFutsal | undefined,
): boolean {
  if (valor === undefined) return true
  if (!objeto(valor)) return false

  for (const chave of ['grupo1', 'grupo2'] as const) {
    const ordem = valor[chave]
    if (ordem === undefined) continue

    const participantes = grupos?.[chave]

    if (
      !participantes
      || !Array.isArray(ordem)
      || ordem.length !== 5
      || new Set(ordem).size !== 5
      || !ordem.every(id =>
        typeof id === 'string' && participantes.includes(id),
      )
    ) {
      return false
    }
  }

  return true
}

function competicaoValida(valor: unknown): valor is Competicao {
  if (!objeto(valor)) return false

  return texto(valor.id, 100)
    && texto(valor.nome, 120)
    && modalidades.some(item => item === valor.modalidade)
    && texto(valor.categoria, 60)
    && texto(valor.edicao, 40)
    && texto(valor.local, 160, false)
    && texto(valor.data, 10, false)
    && (valor.data === '' || dataValida(valor.data))
    && texto(valor.criadaEm, 40)
    && !Number.isNaN(Date.parse(valor.criadaEm))
    && equipesValidas(valor.equipes)
    && gruposValidos(valor.grupos, valor.equipes)
    && (valor.grupos === undefined || valor.modalidade === 'Futsal')
    && resultadosValidos(valor.resultados, valor.grupos as GruposFutsal | undefined,)
    && (valor.resultados === undefined || (Array.isArray(valor.resultados) && valor.resultados.length === 0)
      || valor.modalidade === 'Futsal')
    && desempatesValidos(valor.desempates, valor.grupos as GruposFutsal | undefined,)
    && resultadosRegionaisValidos(
      valor.resultadosRegionais,
      valor as unknown as Competicao,
    )
    && sorteioColoniaValido(
      valor.sorteioColonia,
      valor as unknown as Competicao,
    )
    && inscricoesValidas(valor.inscricoes, valor as unknown as Competicao)
    && participacoesValidas(valor.participacoes, valor as unknown as Competicao)
    && confraternizacaoValida(valor.confraternizacao, valor as unknown as Competicao)
    && damasValidas(valor.damas, valor as unknown as Competicao)
    && etapasDamasValidas(valor as unknown as Competicao)
    && resultadosColoniaValidos(
      valor.resultadosColonia,
      valor as unknown as Competicao,
    )
}

export async function exportarBackup(): Promise<void> {
  const backup: Backup = {
    aplicativo: 'aes-competicoes',
    versao: 13,
    exportadoEm: new Date().toISOString(),
    competicoes: await listarCompeticoes(),
  }

  const arquivo = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: 'application/json' },
  )

  const url = URL.createObjectURL(arquivo)
  const link = document.createElement('a')
  const horario = backup.exportadoEm.replace(/[:.]/g, '-')

  link.href = url
  link.download = `aes-competicoes-${horario}.json`

  document.body.append(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function lerBackup(arquivo: File): Promise<Competicao[]> {
  if (arquivo.size > 5 * 1024 * 1024) {
    throw new Error('O arquivo ultrapassa o limite de 5 MB desta versão.')
  }

  let conteudo: unknown

  try {
    conteudo = JSON.parse(await arquivo.text())
  } catch {
    throw new Error('Não foi possível ler o arquivo como um backup JSON.')
  }

  if (
    !objeto(conteudo)
    || conteudo.aplicativo !== 'aes-competicoes'
    || (
      conteudo.versao !== 1
      && conteudo.versao !== 2
      && conteudo.versao !== 3
      && conteudo.versao !== 4
      && conteudo.versao !== 5
      && conteudo.versao !== 6
      && conteudo.versao !== 7
      && conteudo.versao !== 8
      && conteudo.versao !== 9
      && conteudo.versao !== 10
      && conteudo.versao !== 11
      && conteudo.versao !== 12
      && conteudo.versao !== 13
    )
    || !Array.isArray(conteudo.competicoes)
  ) {
    throw new Error('O arquivo não é um backup compatível da AES Competições.')
  }

  const registros: Competicao[] = []
  const identificadores = new Set<string>()

  for (const item of conteudo.competicoes) {
    if (!competicaoValida(item)) {
      throw new Error('O backup contém uma competição com dados inválidos.')
    }

    if (identificadores.has(item.id)) {
      throw new Error('O backup contém identificadores duplicados.')
    }

    identificadores.add(item.id)

    // Copia somente os campos conhecidos.
    registros.push({
      damasRegional: item.damasRegional ? copiarDamas(item.damasRegional) : undefined,
      damasFinalDaRegional: item.damasFinalDaRegional,
      damas: item.damas ? copiarDamas(item.damas) : undefined,
      confraternizacao: item.confraternizacao ? copiarConfraternizacao(item.confraternizacao) : undefined,
      inscricoes: item.inscricoes ? copiarInscricoes(item.inscricoes) : undefined,
      participacoes: item.participacoes ? copiarParticipacoes(item.participacoes) : undefined,
      id: item.id,
      nome: item.nome,
      modalidade: item.modalidade,
      categoria: item.categoria,
      edicao: item.edicao,
      data: item.data,
      local: item.local,
      criadaEm: item.criadaEm,
      resultadosColonia: (item.resultadosColonia ?? []).map(
          resultado => ({
            jogo: resultado.jogo,
            equipe1: resultado.equipe1,
            equipe2: resultado.equipe2,
            gols1: resultado.gols1,
            gols2: resultado.gols2,
            ...(resultado.penaltis1 !== undefined
                ? {penaltis1: resultado.penaltis1}
                : {}),
            ...(resultado.penaltis2 !== undefined
                ? {penaltis2: resultado.penaltis2}
                : {}),
          }),
      ),
      sorteioColonia: item.sorteioColonia
          ? [...item.sorteioColonia]
          : undefined,
      resultadosRegionais: (item.resultadosRegionais ?? []).map(
          resultado => ({
            jogo: resultado.jogo,
            equipe1: resultado.equipe1,
            equipe2: resultado.equipe2,
            gols1: resultado.gols1,
            gols2: resultado.gols2,
            ...(resultado.penaltis1 !== undefined
                ? {penaltis1: resultado.penaltis1}
                : {}),
            ...(resultado.penaltis2 !== undefined
                ? {penaltis2: resultado.penaltis2}
                : {}),
          }),
      ),
      equipes: (item.equipes ?? []).map(equipe => ({
        id: equipe.id,
        nome: equipe.nome,
        unidade: equipe.unidade,
      })),
      grupos: item.grupos ? {
        grupo1: [...item.grupos.grupo1],
        grupo2: [...item.grupos.grupo2],
      } : undefined,
      resultados: (item.resultados ?? []).map(resultado => ({
        grupo: resultado.grupo,
        jogo: resultado.jogo,
        gols1: resultado.gols1,
        gols2: resultado.gols2,
        ...(resultado.perdedorSorteado !== undefined
            ? {perdedorSorteado: resultado.perdedorSorteado}
            : {}),
      })),
      desempates: item.desempates ? {
        grupo1: item.desempates.grupo1
            ? [...item.desempates.grupo1]
            : undefined,
        grupo2: item.desempates.grupo2
            ? [...item.desempates.grupo2]
            : undefined,
      } : undefined,
    })
  }

  return registros
}