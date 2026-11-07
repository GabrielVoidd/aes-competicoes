export type ResultadoFutsal = {
  grupo: 1 | 2
  jogo: number
  gols1: number
  gols2: number
  // Define apenas o caminho no chaveamento após um empate.
  perdedorSorteado?: string
}

export function participantesDoJogo(
  ids: string[],
  resultados: ResultadoFutsal[],
  grupo: 1 | 2,
  jogo: number,
): [string | undefined, string | undefined] {
  function destino(numero: number, perdedor: boolean): string | undefined {
    const resultado = resultados.find(
      item => item.grupo === grupo && item.jogo === numero,
    )

    if (!resultado) return undefined

    const primeiro = numero === 1 ? ids[0] : ids[2]
    const segundo = numero === 1 ? ids[1] : ids[3]

    if (!primeiro || !segundo) return undefined

    let idPerdedor: string

    if (resultado.gols1 === resultado.gols2) {
      if (!resultado.perdedorSorteado) return undefined
      idPerdedor = resultado.perdedorSorteado
    } else {
      idPerdedor = resultado.gols1 < resultado.gols2
        ? primeiro
        : segundo
    }

    if (perdedor) return idPerdedor
    return idPerdedor === primeiro ? segundo : primeiro
  }

  switch (jogo) {
    case 1: return [ids[0], ids[1]]
    case 2: return [ids[2], ids[3]]
    case 3: return [ids[4], destino(1, true)]
    case 4: return [destino(2, true), destino(1, false)]
    case 5: return [destino(2, false), ids[4]]
    default: return [undefined, undefined]
  }
}

export function temDependentes(
  resultados: ResultadoFutsal[],
  grupo: 1 | 2,
  jogo: number,
): boolean {
  const dependentes = jogo === 1 ? [3, 4] : jogo === 2 ? [4, 5] : []

  return resultados.some(
    item => item.grupo === grupo && dependentes.includes(item.jogo),
  )
}

export function resultadosValidos(
  valor: unknown,
  grupos?: { grupo1: string[]; grupo2: string[] },
): valor is ResultadoFutsal[] | undefined {
  if (valor === undefined) return true
  if (!Array.isArray(valor)) return false
  if (valor.length === 0) return true
  if (!grupos || valor.length > 10) return false

  const resultados: ResultadoFutsal[] = []
  const chaves = new Set<string>()

  for (const item of valor) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return false
    }

    const r = item as Record<string, unknown>

    if (
      (r.grupo !== 1 && r.grupo !== 2)
      || typeof r.jogo !== 'number'
      || !Number.isInteger(r.jogo)
      || r.jogo < 1
      || r.jogo > 5
      || typeof r.gols1 !== 'number'
      || !Number.isSafeInteger(r.gols1)
      || r.gols1 < 0
      || typeof r.gols2 !== 'number'
      || !Number.isSafeInteger(r.gols2)
      || r.gols2 < 0
    ) {
      return false
    }

    const chave = `${r.grupo}-${r.jogo}`
    if (chaves.has(chave)) return false
    chaves.add(chave)

    const ids = r.grupo === 1 ? grupos.grupo1 : grupos.grupo2
    const precisaSorteio = r.jogo <= 2 && r.gols1 === r.gols2

    if (precisaSorteio) {
      const inicio = r.jogo === 1 ? 0 : 2

      if (
        typeof r.perdedorSorteado !== 'string'
        || !ids.slice(inicio, inicio + 2).includes(r.perdedorSorteado)
      ) {
        return false
      }
    } else if (r.perdedorSorteado !== undefined) {
      return false
    }

    resultados.push(item as ResultadoFutsal)
  }

  // Um resultado só pode existir se as duas equipes já estiverem definidas.
  return resultados.every(resultado => {
    const ids = resultado.grupo === 1 ? grupos.grupo1 : grupos.grupo2
    const [primeiro, segundo] = participantesDoJogo(
      ids, resultados, resultado.grupo, resultado.jogo,
    )

    return Boolean(primeiro && segundo && primeiro !== segundo)
  })
}