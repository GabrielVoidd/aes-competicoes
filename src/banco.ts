import { validarDamas, copiarDamas, classificadosRegional, etapasDamasValidas, damasVazia } from './regras-damas'
import type { Damas } from './regras-damas'
import { validarConfraternizacao, confraternizacaoValida, copiarConfraternizacao } from './regras-confraternizacao'
import type { Confraternizacao } from './regras-confraternizacao'
import { validarParticipacoes, participacoesValidas, copiarParticipacoes } from './regras-participacoes'
import type { Participacoes } from './regras-participacoes'
import { validarInscricoes, copiarInscricoes } from './regras-inscricoes'
import type { Inscricoes } from './regras-inscricoes'
import {
  obterConfrontos,
  resultadosRegionaisValidos,
  sorteioColoniaValido,
  resultadosColoniaValidos,
} from './regras-regionais'
import type {
  ResultadoRegional,
  ResultadoColonia,
} from './regras-regionais'
import { resultadosValidos, temDependentes } from './futsal'
import type { ResultadoFutsal } from './futsal'

export const modalidades = [
  'Futsal',
  'Basquete',
  'Vôlei',
  'Truco',
  'Damas',
  'Tranca',
  'Tênis de mesa',
  'Natação',
  'Futebol society',
] as const

export type Modalidade = typeof modalidades[number]

export type Equipe = {
  id: string
  nome: string
  unidade: string
}

export type GruposFutsal = {
  grupo1: string[]
  grupo2: string[]
}

export type Competicao = {
  damas?: Damas
  damasRegional?: Damas
  damasFinalDaRegional?: boolean
  confraternizacao?: Confraternizacao
  participacoes?: Participacoes
  inscricoes?: Inscricoes
  id: string
  nome: string
  modalidade: Modalidade
  categoria: string
  edicao: string
  data: string
  local: string
  criadaEm: string
  equipes?: Equipe[]
  grupos?: GruposFutsal
  resultados?: ResultadoFutsal[]
  resultadosRegionais?: ResultadoRegional[]
  desempates?: {
    grupo1?: string[]
    grupo2?: string[]
  }
  sorteioColonia?: string[]
  resultadosColonia?: ResultadoColonia[]
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open('aes-competicoes', 1)

    pedido.onupgradeneeded = () => {
      const banco = pedido.result

      if (!banco.objectStoreNames.contains('competicoes')) {
        banco.createObjectStore('competicoes', { keyPath: 'id' })
      }
    }

    pedido.onsuccess = () => {
      const banco = pedido.result
      banco.onversionchange = () => banco.close()
      resolve(banco)
    }

    pedido.onerror = () => reject(pedido.error)

    pedido.onblocked = () => {
      reject(new Error('Feche outras abas da aplicação e tente novamente.'))
    }
  })
}

export async function listarCompeticoes(): Promise<Competicao[]> {
  const banco = await abrirBanco()

  try {
    return await new Promise<Competicao[]>((resolve, reject) => {
      const transacao = banco.transaction('competicoes', 'readonly')
      const pedido = transacao.objectStore('competicoes').getAll()

      transacao.oncomplete = () => {
        const registros = pedido.result as Competicao[]
        resolve(registros.sort((a, b) =>
          b.criadaEm.localeCompare(a.criadaEm),
        ))
      }

      transacao.onabort = () => reject(
        transacao.error ?? new Error('Não foi possível carregar os dados.'),
      )
    })
  } finally {
    banco.close()
  }
}

export async function salvarCompeticao(
  competicao: Competicao,
): Promise<void> {
  const banco = await abrirBanco()

  try {
    await new Promise<void>((resolve, reject) => {
      const transacao = banco.transaction('competicoes', 'readwrite')

      transacao.objectStore('competicoes').add(competicao)

      // Só confirma o salvamento depois que a transação termina.
      transacao.oncomplete = () => resolve()

      transacao.onabort = () => reject(
        transacao.error ?? new Error('Não foi possível salvar os dados.'),
      )
    })
  } finally {
    banco.close()
  }
}

export async function importarCompeticoes(
  registros: Competicao[],
): Promise<number> {
  const banco = await abrirBanco()

  try {
    return await new Promise<number>((resolve, reject) => {
      const transacao = banco.transaction('competicoes', 'readwrite')
      const tabela = transacao.objectStore('competicoes')
      let adicionadas = 0

      for (const registro of registros) {
        const consulta = tabela.get(registro.id)

        consulta.onsuccess = () => {
          // Preserva a versão local quando o identificador já existe.
          if (consulta.result === undefined) {
            tabela.add(registro)
            adicionadas++
          }
        }
      }

      transacao.oncomplete = () => resolve(adicionadas)

      transacao.onabort = () => reject(
        transacao.error ?? new Error('Não foi possível importar o backup.'),
      )
    })
  } finally {
    banco.close()
  }
}

export async function adicionarEquipe(
  competicaoId: string,
  equipe: Equipe,
): Promise<Competicao> {
  const banco = await abrirBanco()

  try {
    return await new Promise<Competicao>((resolve, reject) => {
      const transacao = banco.transaction('competicoes', 'readwrite')
      const tabela = transacao.objectStore('competicoes')
      const consulta = tabela.get(competicaoId)

      let atualizada: Competicao | undefined
      let motivo = 'Não foi possível salvar a equipe.'

      consulta.onsuccess = () => {
        const competicao = consulta.result as Competicao | undefined

        if (!competicao) {
          motivo = 'A competição não foi encontrada.'
          transacao.abort()
          return
        }

        if ((competicao.resultados ?? []).length > 0) {
          motivo = 'Não é possível alterar os participantes ou grupos após registrar resultados.'
          transacao.abort()
          return
        }

        const equipes = competicao.equipes ?? []
        const normalizar = (texto: string) =>
          texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')

        const repetida = equipes.some(item =>
          normalizar(item.nome) === normalizar(equipe.nome)
          && normalizar(item.unidade) === normalizar(equipe.unidade),
        )

        if (repetida) {
          motivo = 'Já existe uma equipe com esse nome e unidade nesta competição.'
          transacao.abort()
          return
        }

        atualizada = {
          ...competicao,
          equipes: [...equipes, equipe],
        }

        tabela.put(atualizada)
      }

      transacao.oncomplete = () => {
        if (atualizada) resolve(atualizada)
        else reject(new Error(motivo))
      }

      transacao.onabort = () => reject(new Error(motivo))
    })
  } finally {
    banco.close()
  }
}

export async function salvarGrupos(
  competicaoId: string,
  grupos: GruposFutsal,
): Promise<void> {
  const banco = await abrirBanco()

  try {
    await new Promise<void>((resolve, reject) => {
      const transacao = banco.transaction('competicoes', 'readwrite')
      const tabela = transacao.objectStore('competicoes')
      const consulta = tabela.get(competicaoId)

      let motivo = 'Não foi possível salvar os grupos.'

      consulta.onsuccess = () => {
        const competicao = consulta.result as Competicao | undefined

        if (!competicao) {
          motivo = 'Competição não encontrada.'
          transacao.abort()
          return
        }

        if ((competicao.resultados ?? []).length > 0) {
          motivo = 'Não é possível alterar os participantes ou grupos após registrar resultados.'
          transacao.abort()
          return
        }

        const equipes = competicao.equipes ?? []
        const selecionadas = [...grupos.grupo1, ...grupos.grupo2]
        const idsEquipes = new Set(equipes.map(equipe => equipe.id))

        const valido =
          competicao.modalidade === 'Futsal'
          && equipes.length === 10
          && grupos.grupo1.length === 5
          && grupos.grupo2.length === 5
          && new Set(selecionadas).size === 10
          && selecionadas.every(id => idsEquipes.has(id))

        if (!valido) {
          motivo = 'Distribua as dez equipes uma única vez, cinco em cada grupo.'
          transacao.abort()
          return
        }

        tabela.put({
          ...competicao,
          grupos: {
            grupo1: [...grupos.grupo1],
            grupo2: [...grupos.grupo2],
          },
        })
      }

      transacao.oncomplete = () => resolve()
      transacao.onabort = () => reject(new Error(motivo))
    })
  } finally {
    banco.close()
  }
}

export async function salvarResultado(
  competicaoId: string,
  resultado: ResultadoFutsal,
  gruposEsperados: GruposFutsal,
): Promise<void> {
  const banco = await abrirBanco()

  try {
    await new Promise<void>((resolve, reject) => {
      const transacao = banco.transaction('competicoes', 'readwrite')
      const tabela = transacao.objectStore('competicoes')
      const consulta = tabela.get(competicaoId)

      let motivo = 'Não foi possível salvar o resultado.'

      consulta.onsuccess = () => {
        const competicao = consulta.result as Competicao | undefined

        if (!competicao || competicao.modalidade !== 'Futsal' || !competicao.grupos) {
          motivo = 'A competição precisa ter grupos de futsal definidos.'
          transacao.abort()
          return
        }

        if ((competicao.resultadosRegionais ?? []).length > 0) {
          motivo = 'A fase regional já possui resultados. Os resultados dos grupos estão bloqueados.'
          transacao.abort()
          return
        }

        const grupos = competicao.grupos
        const mesmosGrupos =
          JSON.stringify(grupos.grupo1) === JSON.stringify(gruposEsperados.grupo1)
          && JSON.stringify(grupos.grupo2) === JSON.stringify(gruposEsperados.grupo2)

        if (!mesmosGrupos) {
          motivo = 'Os grupos foram alterados. Feche e abra novamente os jogos.'
          transacao.abort()
          return
        }

        const equipes = competicao.equipes ?? []
        const ids = [...grupos.grupo1, ...grupos.grupo2]
        const inscritos = new Set(equipes.map(equipe => equipe.id))

        if (
          equipes.length !== 10
          || grupos.grupo1.length !== 5
          || grupos.grupo2.length !== 5
          || new Set(ids).size !== 10
          || ids.some(id => !inscritos.has(id))
        ) {
          motivo = 'Revise os participantes e os grupos antes de lançar resultados.'
          transacao.abort()
          return
        }

        const anteriores = competicao.resultados ?? []

        if (temDependentes(anteriores, resultado.grupo, resultado.jogo)) {
          motivo = 'Este jogo já possui partidas seguintes com resultados registrados.'
          transacao.abort()
          return
        }

        const atualizados = anteriores.filter(item =>
          item.grupo !== resultado.grupo || item.jogo !== resultado.jogo,
        )

        atualizados.push(resultado)

        if (!resultadosValidos(atualizados, grupos)) {
          motivo = 'Resultado inválido ou equipes ainda não definidas.'
          transacao.abort()
          return
        }

        const desempates = {...competicao.desempates}

        if (resultado.grupo === 1) {
          delete desempates.grupo1
        } else {
          delete desempates.grupo2
        }

        const proposta = { ...competicao, resultados: atualizados, desempates }
        if (!participacoesValidas(competicao.participacoes, proposta)) {
          motivo = 'A alteração conflita com participações já registradas.'
          transacao.abort()
          return
        }
        tabela.put(proposta)
      }

      transacao.oncomplete = () => resolve()
      transacao.onabort = () => reject(new Error(motivo))
    })
  } finally {
    banco.close()
  }
}

export async function salvarDesempate(
  competicaoId: string,
  grupo: 1 | 2,
  ordem: string[],
  resultadosEsperados: ResultadoFutsal[],
): Promise<void> {
  const banco = await abrirBanco()

  try {
    await new Promise<void>((resolve, reject) => {
      const transacao = banco.transaction('competicoes', 'readwrite')
      const tabela = transacao.objectStore('competicoes')
      const consulta = tabela.get(competicaoId)

      let motivo = 'Não foi possível salvar o desempate.'

      consulta.onsuccess = () => {
        const competicao = consulta.result as Competicao | undefined
        const chave = grupo === 1 ? 'grupo1' : 'grupo2'
        const participantes = competicao?.grupos?.[chave]
        const resultados = competicao?.resultados ?? []

        if (
          !competicao
          || competicao.modalidade !== 'Futsal'
          || !participantes
        ) {
          motivo = 'Competição ou grupo não encontrado.'
          transacao.abort()
          return
        }

        if ((competicao.resultadosRegionais ?? []).length > 0) {
          motivo = 'A fase regional já possui resultados. Os sorteios da classificação estão bloqueados.'
          transacao.abort()
          return
        }

        const atuais = resultados
          .filter(item => item.grupo === grupo)
          .sort((a, b) => a.jogo - b.jogo)

        const esperados = resultadosEsperados
          .filter(item => item.grupo === grupo)
          .sort((a, b) => a.jogo - b.jogo)

        if (
          atuais.length !== 5
          || JSON.stringify(atuais) !== JSON.stringify(esperados)
        ) {
          motivo = 'Os resultados mudaram ou estão incompletos. Reabra a classificação.'
          transacao.abort()
          return
        }

        if (
          ordem.length !== 5
          || new Set(ordem).size !== 5
          || ordem.some(id => !participantes.includes(id))
        ) {
          motivo = 'A ordem deve conter as cinco equipes do grupo, sem repetição.'
          transacao.abort()
          return
        }

        tabela.put({
          ...competicao,
          desempates: {
            ...competicao.desempates,
            [chave]: [...ordem],
          },
        })
      }

      transacao.oncomplete = () => resolve()
      transacao.onabort = () => reject(new Error(motivo))
    })
  } finally {
    banco.close()
  }
}

export async function salvarResultadoRegional(
  competicaoId: string,
  resultado: ResultadoRegional,
  competicaoEsperada: Competicao,
): Promise<void> {
  const banco = await abrirBanco()

  try {
    await new Promise<void>((resolve, reject) => {
      const transacao = banco.transaction('competicoes', 'readwrite')
      const tabela = transacao.objectStore('competicoes')
      const consulta = tabela.get(competicaoId)

      let motivo = 'Não foi possível salvar o resultado regional.'

      consulta.onsuccess = () => {
        try {
          const competicao = consulta.result as Competicao | undefined

          if (!competicao) {
            throw new Error('Competição não encontrada.')
          }

          if (competicao.sorteioColonia !== undefined) {
            throw new Error(
                'As semifinais já foram sorteadas. Os resultados regionais estão bloqueados.',
            )
          }

          const confrontos = obterConfrontos(competicao)
          const esperados = obterConfrontos(competicaoEsperada)

          if (JSON.stringify(confrontos) !== JSON.stringify(esperados)) {
            throw new Error(
              'Os confrontos mudaram. Feche e abra novamente a fase regional.',
            )
          }

          const anteriores = competicao.resultadosRegionais ?? []

          if (!resultadosRegionaisValidos(anteriores, competicao)) {
            throw new Error('Existem resultados regionais inconsistentes.')
          }

          const anterior = anteriores.find(
            item => item.jogo === resultado.jogo,
          )

          const esperado = competicaoEsperada.resultadosRegionais?.find(
            item => item.jogo === resultado.jogo,
          )

          if (JSON.stringify(anterior) !== JSON.stringify(esperado)) {
            throw new Error(
              'Este resultado foi alterado em outra aba. Reabra a fase regional.',
            )
          }

          const atualizados = anteriores.filter(
            item => item.jogo !== resultado.jogo,
          )

          atualizados.push(resultado)
          atualizados.sort((a, b) => a.jogo - b.jogo)

          if (!resultadosRegionaisValidos(atualizados, competicao)) {
            throw new Error(
              'Confira os placares. Em caso de empate, informe pênaltis com um vencedor.',
            )
          }

          tabela.put({
            ...competicao,
            resultadosRegionais: atualizados,
          })
        } catch (erro) {
          motivo = erro instanceof Error ? erro.message : motivo
          transacao.abort()
        }
      }

      transacao.oncomplete = () => resolve()
      transacao.onabort = () => reject(new Error(motivo))
    })
  } finally {
    banco.close()
  }
}

export async function salvarSorteioColonia(
  competicaoId: string,
  ordem: string[],
  resultadosEsperados: ResultadoRegional[],
): Promise<void> {
  const banco = await abrirBanco()

  try {
    await new Promise<void>((resolve, reject) => {
      const transacao = banco.transaction('competicoes', 'readwrite')
      const tabela = transacao.objectStore('competicoes')
      const consulta = tabela.get(competicaoId)

      let motivo = 'Não foi possível salvar o sorteio.'

      consulta.onsuccess = () => {
        try {
          const competicao = consulta.result as Competicao | undefined

          if (!competicao) {
            throw new Error('Competição não encontrada.')
          }

          if (competicao.sorteioColonia !== undefined) {
            throw new Error(
              'O sorteio já foi registrado. Feche e reabra a etapa da colônia.',
            )
          }

          const atuais = [...(competicao.resultadosRegionais ?? [])]
            .sort((a, b) => a.jogo - b.jogo)

          const esperados = [...resultadosEsperados]
            .sort((a, b) => a.jogo - b.jogo)

          if (JSON.stringify(atuais) !== JSON.stringify(esperados)) {
            throw new Error(
              'Os resultados regionais mudaram. Reabra a etapa da colônia.',
            )
          }

          if (!sorteioColoniaValido(ordem, competicao)) {
            throw new Error(
              'Conclua a regional e distribua os quatro classificados sem repetir equipes.',
            )
          }

          tabela.put({
            ...competicao,
            sorteioColonia: [...ordem],
          })
        } catch (erro) {
          motivo = erro instanceof Error ? erro.message : motivo
          transacao.abort()
        }
      }

      transacao.oncomplete = () => resolve()
      transacao.onabort = () => reject(new Error(motivo))
    })
  } finally {
    banco.close()
  }
}

export async function salvarResultadoColonia(
  competicaoId: string,
  resultado: ResultadoColonia,
  competicaoEsperada: Competicao,
): Promise<void> {
  const banco = await abrirBanco()

  try {
    await new Promise<void>((resolve, reject) => {
      const transacao = banco.transaction('competicoes', 'readwrite')
      const tabela = transacao.objectStore('competicoes')
      const consulta = tabela.get(competicaoId)

      let motivo = 'Não foi possível salvar o resultado da colônia.'

      consulta.onsuccess = () => {
        try {
          const competicao = consulta.result as Competicao | undefined

          if (!competicao) {
            throw new Error('Competição não encontrada.')
          }

          const anteriores = competicao.resultadosColonia ?? []

          if (!resultadosColoniaValidos(anteriores, competicao)) {
            throw new Error('Existem resultados da colônia inconsistentes.')
          }

          function retrato(item: Competicao): string {
            return JSON.stringify({
              sorteio: item.sorteioColonia,
              regional: [...(item.resultadosRegionais ?? [])]
                .sort((a, b) => a.jogo - b.jogo),
              colonia: [...(item.resultadosColonia ?? [])]
                .sort((a, b) => a.jogo - b.jogo),
            })
          }

          if (retrato(competicao) !== retrato(competicaoEsperada)) {
            throw new Error(
              'Os dados mudaram em outra aba. Feche e reabra a etapa da colônia.',
            )
          }

          if (
            resultado.jogo <= 2
            && anteriores.some(item => item.jogo >= 3)
          ) {
            throw new Error(
              'As semifinais estão bloqueadas porque a final ou o terceiro lugar já possui resultado.',
            )
          }

          const atualizados = anteriores.filter(
            item => item.jogo !== resultado.jogo,
          )

          atualizados.push(resultado)
          atualizados.sort((a, b) => a.jogo - b.jogo)

          if (!resultadosColoniaValidos(atualizados, competicao)) {
            throw new Error(
              'Confira os participantes e placares. Em caso de empate, informe pênaltis com um vencedor.',
            )
          }

          tabela.put({
            ...competicao,
            resultadosColonia: atualizados,
          })
        } catch (erro) {
          motivo = erro instanceof Error ? erro.message : motivo
          transacao.abort()
        }
      }

      transacao.oncomplete = () => resolve()
      transacao.onabort = () => reject(new Error(motivo))
    })
  } finally {
    banco.close()
  }
}
export async function salvarInscricoes(
  competicaoId: string, dados: Inscricoes, esperado: Inscricoes | undefined,
): Promise<Competicao> {
  // Captura os argumentos antes de qualquer espera assíncrona.
  const copia = copiarInscricoes(dados)
  const versaoEsperada = JSON.stringify(esperado)
  const banco = await abrirBanco()
  try {
    return await new Promise<Competicao>((resolve, reject) => {
      const tx = banco.transaction('competicoes', 'readwrite')
      const tabela = tx.objectStore('competicoes')
      const pedido = tabela.get(competicaoId)
      let atualizada: Competicao | undefined
      let motivo = 'Não foi possível salvar as inscrições.'
      pedido.onsuccess = () => {
        try {
          const atual = pedido.result as Competicao | undefined
          if (!atual) throw new Error('Competição não encontrada.')
          if (JSON.stringify(atual.inscricoes) !== versaoEsperada) throw new Error('As inscrições mudaram em outra aba. Feche e reabra esta tela antes de salvar.')
          validarInscricoes(copia, atual)
          atualizada = { ...atual, inscricoes: copia }
          if (!confraternizacaoValida(atual.confraternizacao, atualizada)) throw new Error('Esta alteração removeria um atleta vinculado à confraternização.')
          if (!participacoesValidas(atual.participacoes, atualizada)) throw new Error('A alteração das inscrições conflita com participações já registradas.')
          tabela.put(atualizada)
        } catch (erro) {
          motivo = erro instanceof Error ? erro.message : motivo
          tx.abort()
        }
      }
      tx.oncomplete = () => atualizada ? resolve(atualizada) : reject(new Error(motivo))
      tx.onabort = () => reject(new Error(motivo))
    })
  } finally { banco.close() }
}

export async function salvarParticipacoes(
  competicaoId: string, dados: Participacoes, esperada: Competicao,
): Promise<Competicao> {
  const copia = copiarParticipacoes(dados)
  function retrato(c: Competicao): string {
    return JSON.stringify({ equipes: c.equipes, grupos: c.grupos, inscricoes: c.inscricoes,
      resultados: c.resultados, desempates: c.desempates, regional: c.resultadosRegionais,
      participacoes: c.participacoes })
  }
  const referencia = retrato(esperada)
  const banco = await abrirBanco()
  try {
    return await new Promise<Competicao>((resolve, reject) => {
      const tx = banco.transaction('competicoes', 'readwrite')
      const tabela = tx.objectStore('competicoes')
      const pedido = tabela.get(competicaoId)
      let atualizada: Competicao | undefined
      let motivo = 'Não foi possível salvar as participações.'
      pedido.onsuccess = () => {
        try {
          const atual = pedido.result as Competicao | undefined
          if (!atual) throw new Error('Competição não encontrada.')
          if (retrato(atual) !== referencia) throw new Error('Inscrições, resultados ou participações mudaram em outra aba. Feche e reabra esta tela.')
          validarParticipacoes(copia, atual)
          // Cancelar uma inscrição preserva a atuação histórica. Novas marcações exigem atleta ativo.
          for (const registro of copia.atuacoes) {
            const antes = atual.participacoes?.atuacoes.find(a => a.partida === registro.partida)?.atletas ?? []
            for (const id of registro.atletas) {
              if (!antes.includes(id) && !atual.inscricoes?.atletas.some(a => a.id === id && a.ativo)) throw new Error('Reative a inscrição antes de acrescentar uma atuação desse atleta.')
            }
          }
          atualizada = { ...atual, participacoes: copia }
          tabela.put(atualizada)
        } catch (erro) {
          motivo = erro instanceof Error ? erro.message : motivo
          tx.abort()
        }
      }
      tx.oncomplete = () => atualizada ? resolve(atualizada) : reject(new Error(motivo))
      tx.onabort = () => reject(new Error(motivo))
    })
  } finally { banco.close() }
}

export async function salvarConfraternizacao(id: string, dados: Confraternizacao, esperada: Competicao): Promise<Competicao> {
  const copia = copiarConfraternizacao(dados)
  const retrato = (c: Competicao) => JSON.stringify({ festa: c.confraternizacao, inscricoes: c.inscricoes })
  const referencia = retrato(esperada)
  const banco = await abrirBanco()
  try {
    return await new Promise<Competicao>((resolve, reject) => {
      const tx = banco.transaction('competicoes', 'readwrite')
      const tabela = tx.objectStore('competicoes'), pedido = tabela.get(id)
      let salvo: Competicao | undefined
      let motivo = 'Não foi possível salvar a confraternização.'
      pedido.onsuccess = () => {
        try {
          const atual = pedido.result as Competicao | undefined
          if (!atual) throw new Error('Competição não encontrada.')
          if (retrato(atual) !== referencia) throw new Error('Os cadastros mudaram em outra aba. Feche e reabra esta tela.')
          validarConfraternizacao(copia, atual)
          salvo = { ...atual, confraternizacao: copia }
          tabela.put(salvo)
        } catch (e) { motivo = e instanceof Error ? e.message : motivo; tx.abort() }
      }
      tx.oncomplete = () => salvo ? resolve(salvo) : reject(new Error(motivo))
      tx.onabort = () => reject(new Error(motivo))
    })
  } finally { banco.close() }
}

export async function salvarDamas(id: string, dados: Damas, esperado: Damas | undefined, etapa: 'regional' | 'final' = 'final'): Promise<Competicao> {
  const chave = etapa === 'regional' ? 'damasRegional' : 'damas'
  const copia = copiarDamas(dados)
  const referencia = JSON.stringify(esperado)
  const banco = await abrirBanco()
  try {
    return await new Promise<Competicao>((resolve, reject) => {
      const tx = banco.transaction('competicoes', 'readwrite')
      const tabela = tx.objectStore('competicoes'), pedido = tabela.get(id)
      let salvo: Competicao | undefined
      let motivo = 'Não foi possível salvar damas.'
      pedido.onsuccess = () => {
        try {
          const atual = pedido.result as Competicao | undefined
          if (!atual) throw new Error('Competição não encontrada.')
          if (etapa === 'regional' && atual.damasFinalDaRegional) throw new Error('A regional está bloqueada porque os classificados já foram enviados para a final.')
          if (etapa === 'final' && !atual.damas) throw new Error('Encerre a regional e envie os dois classificados antes de abrir a final.')
          if (JSON.stringify(atual[chave]) !== referencia) throw new Error('Damas mudou em outra aba. Feche e reabra esta tela antes de continuar.')
          const anterior = atual[chave]
          if (anterior?.encerrada) {
            const reaberto = { ...anterior, encerrada: false }
            if (JSON.stringify(copia) !== JSON.stringify(copiarDamas(reaberto))) throw new Error('Reabra a competição antes de alterar os dados.')
          }
          if (anterior?.resultados.some(r => r.partidas.length || r.extras.length)
            && JSON.stringify(copia.ordem) !== JSON.stringify(anterior.ordem)) throw new Error('A tabela está bloqueada porque já existem partidas registradas.')
          validarDamas(copia, atual, etapa === 'regional')
          salvo = { ...atual, [chave]: copia }
          if (!etapasDamasValidas(salvo)) throw new Error('A final deve manter os dois classificados da regional.')
          if (!confraternizacaoValida(atual.confraternizacao, salvo)) throw new Error('Há participante vinculado à confraternização. Preserve seu cadastro.')
          tabela.put(salvo)
        } catch (e) { motivo = e instanceof Error ? e.message : motivo; tx.abort() }
      }
      tx.oncomplete = () => salvo ? resolve(salvo) : reject(new Error(motivo))
      tx.onabort = () => reject(new Error(motivo))
    })
  } finally { banco.close() }
}

export async function avancarRegionalDamas(id: string, esperado: Damas): Promise<Competicao> {
  const referencia = JSON.stringify(esperado)
  const banco = await abrirBanco()
  try {
    return await new Promise<Competicao>((resolve, reject) => {
      const tx = banco.transaction('competicoes', 'readwrite'), tabela = tx.objectStore('competicoes')
      const pedido = tabela.get(id)
      let salvo: Competicao | undefined, motivo = 'Não foi possível abrir a final.'
      pedido.onsuccess = () => {
        try {
          const c = pedido.result as Competicao | undefined
          if (!c || JSON.stringify(c.damasRegional) !== referencia) throw new Error('A regional mudou. Feche e reabra a tela.')
          if (c.damas) throw new Error('Já existe uma final nesta competição. Ela foi preservada. Para testar o fluxo completo, crie uma nova competição.')
          const ids = classificadosRegional(c)
          if (ids.length !== 2) throw new Error('Encerre a regional com classificação definida antes de avançar.')
          const final = damasVazia()
          final.participantes = ids.map(id => ({ ...c.damasRegional!.participantes.find(p => p.id === id)!, classificado: true }))
          final.ordem = [...ids]
          salvo = { ...c, damas: final, damasFinalDaRegional: true }
          validarDamas(final, salvo)
          tabela.put(salvo)
        } catch (e) { motivo = e instanceof Error ? e.message : motivo; tx.abort() }
      }
      tx.oncomplete = () => salvo ? resolve(salvo) : reject(new Error(motivo))
      tx.onabort = () => reject(new Error(motivo))
    })
  } finally { banco.close() }
}
