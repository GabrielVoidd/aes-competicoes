import type { Competicao } from './banco'
import { participantesDoJogo, resultadosValidos } from './futsal'

export type ResultadoRegional = {
  jogo: number
  equipe1: string
  equipe2: string
  gols1: number
  gols2: number
  penaltis1?: number
  penaltis2?: number
}

export type ConfrontoRegional = {
  numero: number
  origem1: string
  origem2: string
  equipe1: string
  equipe2: string
}

function ordemFinal(competicao: Competicao, grupo: 1 | 2): string[] {
  const chave = grupo === 1 ? 'grupo1' : 'grupo2'
  const ids = competicao.grupos![chave]
  const resultados = competicao.resultados ?? []
  const jogos = resultados.filter(item => item.grupo === grupo)

  if (jogos.length !== 5) {
    throw new Error(`Conclua os cinco jogos do Grupo ${grupo}.`)
  }

  const linhas = ids.map(id => ({
    id,
    pontos: 0,
    marcados: 0,
    sofridos: 0,
  }))

  for (const resultado of jogos) {
    const [id1, id2] = participantesDoJogo(
      ids, resultados, grupo, resultado.jogo,
    )

    const primeira = linhas.find(item => item.id === id1)
    const segunda = linhas.find(item => item.id === id2)

    if (!primeira || !segunda) {
      throw new Error('Existem partidas com participantes indefinidos.')
    }

    primeira.marcados += resultado.gols1
    primeira.sofridos += resultado.gols2
    segunda.marcados += resultado.gols2
    segunda.sofridos += resultado.gols1

    if (resultado.gols1 === resultado.gols2) {
      primeira.pontos++
      segunda.pontos++
    } else if (resultado.gols1 > resultado.gols2) {
      primeira.pontos += 3
    } else {
      segunda.pontos += 3
    }
  }

  type Linha = typeof linhas[number]

  function comparar(a: Linha, b: Linha): number {
    return b.pontos - a.pontos
      || (b.marcados - b.sofridos) - (a.marcados - a.sofridos)
      || b.marcados - a.marcados
      || a.sofridos - b.sofridos
  }

  linhas.sort(comparar)

  const temEmpate = linhas.some((linha, indice) => {
    const anterior = linhas[indice - 1]
    return anterior !== undefined && comparar(linha, anterior) === 0
  })

  if (temEmpate) {
    const ordem = competicao.desempates?.[chave]

    if (
      !ordem
      || ordem.length !== 5
      || new Set(ordem).size !== 5
      || ordem.some(id => !ids.includes(id))
    ) {
      throw new Error(
        `Registre o sorteio de desempate do Grupo ${grupo} na classificação.`,
      )
    }

    linhas.sort((a, b) =>
      comparar(a, b) || ordem.indexOf(a.id) - ordem.indexOf(b.id),
    )
  }

  return linhas.map(item => item.id)
}

export function obterConfrontos(
  competicao: Competicao,
): ConfrontoRegional[] {
  const grupos = competicao.grupos
  const equipes = competicao.equipes ?? []

  if (competicao.modalidade !== 'Futsal' || !grupos) {
    throw new Error('A competição precisa ter grupos de futsal definidos.')
  }

  const ids = [...grupos.grupo1, ...grupos.grupo2]
  const inscritos = new Set(equipes.map(item => item.id))

  if (
    equipes.length !== 10
    || inscritos.size !== 10
    || grupos.grupo1.length !== 5
    || grupos.grupo2.length !== 5
    || new Set(ids).size !== 10
    || ids.some(id => !inscritos.has(id))
    || !resultadosValidos(competicao.resultados, grupos)
  ) {
    throw new Error('Os grupos ou resultados possuem dados inconsistentes.')
  }

  const grupo1 = ordemFinal(competicao, 1)
  const grupo2 = ordemFinal(competicao, 2)

  function equipe(ordem: string[], indice: number): string {
    const id = ordem[indice]
    if (!id) throw new Error('Equipe classificada não encontrada.')
    return id
  }

  return [
    {
      numero: 1,
      origem1: '2º do Grupo 1',
      origem2: '3º do Grupo 2',
      equipe1: equipe(grupo1, 1),
      equipe2: equipe(grupo2, 2),
    },
    {
      numero: 2,
      origem1: '2º do Grupo 2',
      origem2: '3º do Grupo 1',
      equipe1: equipe(grupo2, 1),
      equipe2: equipe(grupo1, 2),
    },
    {
      numero: 3,
      origem1: '1º do Grupo 1',
      origem2: '4º do Grupo 2',
      equipe1: equipe(grupo1, 0),
      equipe2: equipe(grupo2, 3),
    },
    {
      numero: 4,
      origem1: '1º do Grupo 2',
      origem2: '4º do Grupo 1',
      equipe1: equipe(grupo2, 0),
      equipe2: equipe(grupo1, 3),
    },
  ]
}

function inteiro(valor: unknown): valor is number {
  return typeof valor === 'number'
    && Number.isSafeInteger(valor)
    && valor >= 0
}

export function resultadosRegionaisValidos(
  valor: unknown,
  competicao: Competicao,
): valor is ResultadoRegional[] | undefined {
  if (valor === undefined) return true
  if (!Array.isArray(valor) || valor.length > 4) return false
  if (valor.length === 0) return true

  try {
    const confrontos = obterConfrontos(competicao)
    const registrados = new Set<number>()

    for (const item of valor) {
      if (
        typeof item !== 'object'
        || item === null
        || Array.isArray(item)
      ) return false

      const resultado = item as Record<string, unknown>

      if (
        !inteiro(resultado.jogo)
        || registrados.has(resultado.jogo)
        || !inteiro(resultado.gols1)
        || !inteiro(resultado.gols2)
      ) return false

      const confronto = confrontos.find(
        partida => partida.numero === resultado.jogo,
      )

      if (
        !confronto
        || resultado.equipe1 !== confronto.equipe1
        || resultado.equipe2 !== confronto.equipe2
      ) return false

      if (resultado.gols1 === resultado.gols2) {
        if (
          !inteiro(resultado.penaltis1)
          || !inteiro(resultado.penaltis2)
          || resultado.penaltis1 === resultado.penaltis2
        ) return false
      } else if (
        resultado.penaltis1 !== undefined
        || resultado.penaltis2 !== undefined
      ) {
        return false
      }

      registrados.add(resultado.jogo)
    }

    return true
  } catch {
    return false
  }
}

// Usar somente depois da validação do resultado.
export function vencedorRegional(resultado: ResultadoRegional): string {
  if (resultado.gols1 !== resultado.gols2) {
    return resultado.gols1 > resultado.gols2
      ? resultado.equipe1
      : resultado.equipe2
  }

  return resultado.penaltis1! > resultado.penaltis2!
    ? resultado.equipe1
    : resultado.equipe2
}

export function sorteioColoniaValido(
  valor: unknown,
  competicao: Competicao,
): valor is string[] | undefined {
  if (valor === undefined) return true

  const resultados = competicao.resultadosRegionais

  if (
    !Array.isArray(valor)
    || valor.length !== 4
    || new Set(valor).size !== 4
    || !resultados
    || resultados.length !== 4
    || !resultadosRegionaisValidos(resultados, competicao)
  ) {
    return false
  }

  const classificados = resultados.map(vencedorRegional)

  return valor.every(id =>
    typeof id === 'string' && classificados.includes(id),
  )
}

export type ResultadoColonia = ResultadoRegional

export type ConfrontoColonia = {
  numero: number
  titulo: string
  equipe1: string | undefined
  equipe2: string | undefined
}

export function obterConfrontosColonia(
  competicao: Competicao,
): ConfrontoColonia[] {
  const ordem = competicao.sorteioColonia

  if (!ordem || !sorteioColoniaValido(ordem, competicao)) {
    throw new Error('Registre um sorteio válido das semifinais.')
  }

  const resultados = competicao.resultadosColonia ?? []
  const semifinal1 = resultados.find(item => item.jogo === 1)
  const semifinal2 = resultados.find(item => item.jogo === 2)

  function vencedor(resultado: ResultadoColonia | undefined) {
    return resultado ? vencedorRegional(resultado) : undefined
  }

  function perdedor(resultado: ResultadoColonia | undefined) {
    if (!resultado) return undefined

    return vencedorRegional(resultado) === resultado.equipe1
      ? resultado.equipe2
      : resultado.equipe1
  }

  return [
    {
      numero: 1,
      titulo: 'Semifinal 1',
      equipe1: ordem[0],
      equipe2: ordem[1],
    },
    {
      numero: 2,
      titulo: 'Semifinal 2',
      equipe1: ordem[2],
      equipe2: ordem[3],
    },
    {
      numero: 3,
      titulo: 'Disputa de terceiro lugar',
      equipe1: perdedor(semifinal1),
      equipe2: perdedor(semifinal2),
    },
    {
      numero: 4,
      titulo: 'Final',
      equipe1: vencedor(semifinal1),
      equipe2: vencedor(semifinal2),
    },
  ]
}

export function resultadosColoniaValidos(
  valor: unknown,
  competicao: Competicao,
): valor is ResultadoColonia[] | undefined {
  if (valor === undefined) return true
  if (!Array.isArray(valor) || valor.length > 4) return false
  if (valor.length === 0) return true

  try {
    // Primeiro valida os campos e placares de todas as partidas.
    const resultados: ResultadoColonia[] = []
    const jogos = new Set<number>()

    for (const item of valor) {
      if (
        typeof item !== 'object'
        || item === null
        || Array.isArray(item)
      ) return false

      const resultado = item as Record<string, unknown>

      if (
        !inteiro(resultado.jogo)
        || resultado.jogo < 1
        || resultado.jogo > 4
        || jogos.has(resultado.jogo)
        || typeof resultado.equipe1 !== 'string'
        || typeof resultado.equipe2 !== 'string'
        || resultado.equipe1 === resultado.equipe2
        || !inteiro(resultado.gols1)
        || !inteiro(resultado.gols2)
      ) return false

      if (resultado.gols1 === resultado.gols2) {
        if (
          !inteiro(resultado.penaltis1)
          || !inteiro(resultado.penaltis2)
          || resultado.penaltis1 === resultado.penaltis2
        ) return false
      } else if (
        resultado.penaltis1 !== undefined
        || resultado.penaltis2 !== undefined
      ) {
        return false
      }

      jogos.add(resultado.jogo)
      resultados.push(resultado as unknown as ResultadoColonia)
    }

    // Depois confere as equipes das semifinais contra o sorteio.
    const semifinais = obterConfrontosColonia({
      ...competicao,
      resultadosColonia: [],
    })

    for (const resultado of resultados.filter(item => item.jogo <= 2)) {
      const confronto = semifinais.find(
        item => item.numero === resultado.jogo,
      )

      if (
        !confronto
        || resultado.equipe1 !== confronto.equipe1
        || resultado.equipe2 !== confronto.equipe2
      ) return false
    }

    // As equipes da final e do terceiro lugar vêm das semifinais validadas.
    const confrontos = obterConfrontosColonia({
      ...competicao,
      resultadosColonia: resultados.filter(item => item.jogo <= 2),
    })

    for (const resultado of resultados.filter(item => item.jogo >= 3)) {
      const confronto = confrontos.find(
        item => item.numero === resultado.jogo,
      )

      if (
        !confronto
        || !confronto.equipe1
        || !confronto.equipe2
        || resultado.equipe1 !== confronto.equipe1
        || resultado.equipe2 !== confronto.equipe2
      ) return false
    }

    return true
  } catch {
    return false
  }
}