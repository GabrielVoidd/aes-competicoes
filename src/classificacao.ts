import { listarCompeticoes, salvarDesempate } from './banco'
import { participantesDoJogo, resultadosValidos } from './futsal'
import type { ResultadoFutsal } from './futsal'

type LinhaClassificacao = {
  equipeId: string
  pontos: number
  jogos: number
  vitorias: number
  empates: number
  derrotas: number
  golsMarcados: number
  golsSofridos: number
  saldo: number
}

export function comparar(
  a: LinhaClassificacao,
  b: LinhaClassificacao,
): number {
  return b.pontos - a.pontos
    || b.saldo - a.saldo
    || b.golsMarcados - a.golsMarcados
    || a.golsSofridos - b.golsSofridos
}

export function calcularGrupo(
  ids: string[],
  resultados: ResultadoFutsal[],
  grupo: 1 | 2,
): LinhaClassificacao[] {
  const linhas = new Map<string, LinhaClassificacao>()

  for (const equipeId of ids) {
    linhas.set(equipeId, {
      equipeId,
      pontos: 0,
      jogos: 0,
      vitorias: 0,
      empates: 0,
      derrotas: 0,
      golsMarcados: 0,
      golsSofridos: 0,
      saldo: 0,
    })
  }

  for (const resultado of resultados) {
    if (resultado.grupo !== grupo) continue

    const [id1, id2] = participantesDoJogo(
      ids, resultados, grupo, resultado.jogo,
    )

    const primeira = id1 ? linhas.get(id1) : undefined
    const segunda = id2 ? linhas.get(id2) : undefined

    if (!primeira || !segunda) {
      throw new Error('Há um resultado com participantes não definidos.')
    }

    primeira.jogos++
    segunda.jogos++

    primeira.golsMarcados += resultado.gols1
    primeira.golsSofridos += resultado.gols2
    segunda.golsMarcados += resultado.gols2
    segunda.golsSofridos += resultado.gols1

    if (resultado.gols1 > resultado.gols2) {
      primeira.pontos += 3
      primeira.vitorias++
      segunda.derrotas++
    } else if (resultado.gols1 < resultado.gols2) {
      segunda.pontos += 3
      segunda.vitorias++
      primeira.derrotas++
    } else {
      primeira.pontos++
      segunda.pontos++
      primeira.empates++
      segunda.empates++
    }
  }

  for (const linha of linhas.values()) {
    linha.saldo = linha.golsMarcados - linha.golsSofridos
  }

  return [...linhas.values()].sort(comparar)
}

export async function abrirClassificacao(
  competicaoId: string,
): Promise<void> {
  const registros = await listarCompeticoes()
  const competicao = registros.find(item => item.id === competicaoId)

  if (!competicao || competicao.modalidade !== 'Futsal') {
    throw new Error('Competição de futsal não encontrada.')
  }

  const grupos = competicao.grupos

  if (!grupos) {
    throw new Error('Monte e salve os grupos antes de abrir a classificação.')
  }

  const equipes = competicao.equipes ?? []
  const porId = new Map(equipes.map(equipe => [equipe.id, equipe]))
  const ids = [...grupos.grupo1, ...grupos.grupo2]
  const resultados = competicao.resultados ?? []

  if (
    equipes.length !== 10
    || grupos.grupo1.length !== 5
    || grupos.grupo2.length !== 5
    || new Set(ids).size !== 10
    || ids.some(id => !porId.has(id))
    || !resultadosValidos(resultados, grupos)
  ) {
    throw new Error('Os grupos ou resultados possuem dados inconsistentes.')
  }

  const janela = document.createElement('dialog')
  janela.className = 'janela-equipes janela-classificacao'
  janela.setAttribute('aria-labelledby', 'titulo-classificacao')

  janela.innerHTML = `
    <div class="titulo-secao">
      <div>
        <h2 id="titulo-classificacao">Classificação</h2>
        <p id="competicao-classificacao"></p>
      </div>

      <button id="fechar-classificacao" class="botao-secundario"
        type="button">
        Fechar
      </button>
    </div>

    <p class="ajuda">
      Critérios: pontos, saldo de gols, gols marcados e menos gols sofridos.
      Somente partidas com resultado salvo entram nos cálculos.
    </p>

    <div id="tabelas-classificacao"></div>

    <p class="ajuda legenda-classificacao">
      P: pontos · J: jogos · V: vitórias · E: empates · D: derrotas ·
      GM: gols marcados · GS: gols sofridos · SG: saldo de gols.
    </p>
  `

  const subtitulo = janela.querySelector('#competicao-classificacao')!
  const tabelas = janela.querySelector('#tabelas-classificacao')!
  const fechar = janela.querySelector('#fechar-classificacao')!

  subtitulo.textContent = `${competicao.nome} · ${competicao.categoria}`

  for (const grupo of [1, 2] as const) {
    const participantes = grupo === 1 ? grupos.grupo1 : grupos.grupo2
    const linhas = calcularGrupo(participantes, resultados, grupo)
    const quantidade = resultados.filter(item => item.grupo === grupo).length

    const chave = grupo === 1 ? 'grupo1' : 'grupo2'
    const ordemSalva = competicao.desempates?.[chave]

    const sorteioRegistrado = quantidade === 5
        && ordemSalva !== undefined
        && ordemSalva.length === 5
        && new Set(ordemSalva).size === 5
        && ordemSalva.every(id => participantes.includes(id))

    if (sorteioRegistrado && ordemSalva) {
        linhas.sort((a, b) =>
        comparar(a, b)
        || ordemSalva.indexOf(a.equipeId) - ordemSalva.indexOf(b.equipeId),
        )
    }

    const secao = document.createElement('section')
    const resumo = document.createElement('p')
    resumo.className = 'ajuda'

    resumo.textContent = quantidade === 5
      ? '5 de 5 jogos registrados.'
      : `${quantidade} de 5 jogos registrados. Classificação parcial.`

    const area = document.createElement('div')
    area.className = 'tabela-rolagem'

    const tabela = document.createElement('table')
    tabela.className = 'tabela-jogos tabela-classificacao'
    tabela.createCaption().textContent = `Grupo ${grupo}`

    const cabecalho = tabela.createTHead().insertRow()

    for (const titulo of [
      'Pos.', 'Equipe', 'P', 'J', 'V', 'E', 'D', 'GM', 'GS', 'SG',
    ]) {
      const coluna = document.createElement('th')
      coluna.scope = 'col'
      coluna.textContent = titulo
      cabecalho.append(coluna)
    }

    const corpo = tabela.createTBody()
    let posicao = 1
    let temEmpate = false

    linhas.forEach((linha, indice) => {
      const anterior = linhas[indice - 1]
      const seguinte = linhas[indice + 1]

      const igualAnterior = anterior !== undefined
        && comparar(linha, anterior) === 0

      const igualSeguinte = seguinte !== undefined
        && comparar(linha, seguinte) === 0

      const empateEsportivo = igualAnterior || igualSeguinte
      const empatada = empateEsportivo && !sorteioRegistrado

      if (!igualAnterior || sorteioRegistrado) posicao = indice + 1
      if (empateEsportivo) temEmpate = true

      const equipe = porId.get(linha.equipeId)!
      const registro = corpo.insertRow()

      const valores = [
        `${posicao}º${empatada ? ' =' : ''}`,
        `${equipe.nome} — ${equipe.unidade}`,
        linha.pontos,
        linha.jogos,
        linha.vitorias,
        linha.empates,
        linha.derrotas,
        linha.golsMarcados,
        linha.golsSofridos,
        linha.saldo,
      ]

      for (const valor of valores) {
        registro.insertCell().textContent = String(valor)
      }
    })

    area.append(tabela)
    secao.append(area, resumo)

      if (temEmpate) {
          const aviso = document.createElement('p')
          aviso.className = 'aviso-classificacao'

          if (sorteioRegistrado) {
              aviso.textContent =
                  'Empates resolvidos pela ordem sorteada registrada pela organização.'
              secao.append(aviso)
          } else if (quantidade < 5) {
              aviso.textContent =
                  'Há equipes empatadas. O sorteio da classificação será registrado '
                  + 'após concluir os cinco jogos deste grupo.'
              secao.append(aviso)
          } else {
              aviso.textContent =
                  'Há empate em todos os critérios. Realize o sorteio e registre '
                  + 'a ordem das equipes empatadas abaixo.'
              secao.append(aviso)

              const formulario = document.createElement('form')
              const campos = document.createElement('fieldset')
              campos.className = 'campos'

              const ordem = linhas.map(linha => linha.equipeId)
              const seletores: {
                  indice: number
                  seletor: HTMLSelectElement
              }[] = []

              let inicio = 0

              while (inicio < linhas.length) {
                  const primeira = linhas[inicio]!
                  let fim = inicio + 1

                  while (
                      fim < linhas.length
                      && comparar(primeira, linhas[fim]!) === 0
                      ) {
                      fim++
                  }

                  if (fim - inicio > 1) {
                      const empatadas = linhas.slice(inicio, fim)

                      for (let indice = inicio; indice < fim; indice++) {
                          const label = document.createElement('label')
                          label.className = 'campo'
                          label.append(document.createTextNode(
                              `Equipe sorteada para o ${indice + 1}º lugar`,
                          ))

                          const seletor = document.createElement('select')
                          seletor.required = true
                          seletor.append(new Option('Selecione', ''))

                          for (const linha of empatadas) {
                              const equipe = porId.get(linha.equipeId)!
                              seletor.append(new Option(
                                  `${equipe.nome} — ${equipe.unidade}`,
                                  equipe.id,
                              ))
                          }

                          seletores.push({indice, seletor})
                          label.append(seletor)
                          campos.append(label)
                      }
                  }

                  inicio = fim
              }

              const botao = document.createElement('button')
              botao.type = 'submit'
              botao.className = 'botao campo-largo'
              botao.textContent = 'Salvar ordem sorteada'
              campos.append(botao)

              const mensagem = document.createElement('p')
              mensagem.className = 'mensagem'
              mensagem.setAttribute('role', 'status')

              formulario.append(campos, mensagem)
              secao.append(formulario)

              formulario.addEventListener('submit', async evento => {
                  evento.preventDefault()
                  if (campos.disabled) return

                  mensagem.classList.remove('mensagem-erro')

                  for (const item of seletores) {
                      ordem[item.indice] = item.seletor.value
                  }

                  if (ordem.some(id => !id) || new Set(ordem).size !== 5) {
                      mensagem.textContent = 'Selecione cada equipe uma única vez.'
                      mensagem.classList.add('mensagem-erro')
                      return
                  }

                  campos.disabled = true

                  try {
                      await salvarDesempate(competicaoId, grupo, ordem, resultados)
                      mensagem.textContent =
                          'Sorteio salvo. Feche e reabra a classificação para ver a ordem atualizada.'
                  } catch (erro) {
                      console.error(erro)
                      mensagem.textContent = erro instanceof Error
                          ? erro.message
                          : 'Não foi possível salvar.'
                      mensagem.classList.add('mensagem-erro')
                      campos.disabled = false
                  }
              })
          }
      }

    tabelas.append(secao)
  }

  fechar.addEventListener('click', () => janela.close())
  janela.addEventListener('close', () => janela.remove(), { once: true })

  document.body.append(janela)
  janela.showModal()
}