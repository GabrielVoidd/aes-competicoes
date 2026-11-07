import { abrirParticipacoes } from './participacoes'
import {
  listarCompeticoes,
  salvarSorteioColonia,
  salvarResultadoColonia,
} from './banco'

import {
  resultadosRegionaisValidos,
  sorteioColoniaValido,
  vencedorRegional,
  obterConfrontosColonia,
  resultadosColoniaValidos,
} from './regras-regionais'

import type { ResultadoColonia } from './regras-regionais'

export async function abrirColonia(competicaoId: string): Promise<void> {
    const registros = await listarCompeticoes()
    const encontrada = registros.find(item => item.id === competicaoId)

    if (!encontrada) {
        throw new Error('Competição não encontrada.')
    }

    const competicao = encontrada

  const resultados = competicao.resultadosRegionais ?? []

  if (
    resultados.length !== 4
    || !resultadosRegionaisValidos(resultados, competicao)
  ) {
    throw new Error(
      'Conclua os quatro jogos regionais antes de abrir a etapa da colônia.',
    )
  }

  if (!sorteioColoniaValido(competicao.sorteioColonia, competicao)) {
    throw new Error('O sorteio salvo possui dados inconsistentes.')
  }

  if (!resultadosColoniaValidos(
      competicao.resultadosColonia, competicao,
  )) {
      throw new Error('Existem resultados da colônia inconsistentes.')
  }

  const classificados = [...resultados]
    .sort((a, b) => a.jogo - b.jogo)
    .map(vencedorRegional)

  const porId = new Map(
    (competicao.equipes ?? []).map(equipe => [equipe.id, equipe]),
  )

  function nome(id: string): string {
    const equipe = porId.get(id)
    if (!equipe) throw new Error('Equipe não encontrada.')
    return `${equipe.nome} — ${equipe.unidade}`
  }

  const janela = document.createElement('dialog')
  janela.className = 'janela-equipes janela-jogos'
  janela.setAttribute('aria-labelledby', 'titulo-colonia')

  janela.innerHTML = `
    <div class="titulo-secao">
      <div>
        <h2 id="titulo-colonia">Etapa da colônia</h2>
        <p id="competicao-colonia"></p>
      </div>
      <button id="fechar-colonia" class="botao-secundario" type="button">
        Fechar
      </button>
    </div>

    <div class="acoes"><button id="conferir-atletas-colonia" class="botao-secundario" type="button">Conferir atletas aptos</button></div>
    <p id="status-colonia" role="status" aria-live="polite"></p>
    <div id="conteudo-colonia"></div>
  `

  janela.querySelector('#competicao-colonia')!.textContent =
    `${competicao.nome} · ${competicao.categoria}`

  const fechar = janela.querySelector<HTMLButtonElement>('#fechar-colonia')!
  const status = janela.querySelector<HTMLElement>('#status-colonia')!
  const conteudo = janela.querySelector<HTMLElement>('#conteudo-colonia')!

  let salvando = false
  const conferir = janela.querySelector<HTMLButtonElement>('#conferir-atletas-colonia')!
  conferir.addEventListener('click', async () => {
    if (salvando) return
    conferir.disabled = true
    try { await abrirParticipacoes(competicaoId) }
    catch (erro) { window.alert(erro instanceof Error ? erro.message : 'Não foi possível consultar os atletas.') }
    finally { conferir.disabled = false }
  })


  function mostrarSemifinais(_ordem: string[]): void {
  conteudo.replaceChildren()

  const resultadosSalvos = competicao.resultadosColonia ?? []
  const confrontos = obterConfrontosColonia(competicao)
  const semifinaisBloqueadas = resultadosSalvos.some(
    item => item.jogo >= 3,
  )

  const aviso = document.createElement('p')
  aviso.className = 'ajuda'
  aviso.textContent =
    'Salve uma partida por vez. Ao salvar, a tela será atualizada. '
    + 'A final e o terceiro lugar serão definidos após as duas semifinais.'

  conteudo.append(aviso)

  function campo(
    destino: HTMLElement,
    titulo: string,
    valor?: number,
  ): HTMLInputElement {
    const rotulo = document.createElement('label')
    rotulo.className = 'campo'

    const texto = document.createElement('span')
    texto.textContent = titulo

    const entrada = document.createElement('input')
    entrada.type = 'number'
    entrada.min = '0'
    entrada.max = String(Number.MAX_SAFE_INTEGER)
    entrada.step = '1'
    entrada.required = true
    entrada.value = valor === undefined ? '' : String(valor)

    rotulo.append(texto, entrada)
    destino.append(rotulo)
    return entrada
  }

  function numero(entrada: HTMLInputElement): number {
    const valor = entrada.valueAsNumber

    if (!Number.isSafeInteger(valor) || valor < 0) {
      throw new Error('Informe placares inteiros, zero ou maiores.')
    }

    return valor
  }

  for (const confronto of confrontos) {
    const formulario = document.createElement('form')
    formulario.className = 'partida'

    const titulo = document.createElement('h3')
    titulo.textContent = confronto.titulo
    formulario.append(titulo)

    const equipe1 = confronto.equipe1
    const equipe2 = confronto.equipe2

    if (!equipe1 || !equipe2) {
      const pendente = document.createElement('p')
      pendente.className = 'ajuda'
      pendente.textContent = 'Aguardando os resultados das duas semifinais.'
      formulario.append(pendente)
      conteudo.append(formulario)
      continue
    }

    const salvo = resultadosSalvos.find(
      item => item.jogo === confronto.numero,
    )

    const campos = document.createElement('fieldset')
    campos.disabled = confronto.numero <= 2 && semifinaisBloqueadas

    const placar = document.createElement('div')
    placar.className = 'campos'

    const gols1 = campo(placar, nome(equipe1), salvo?.gols1)
    const gols2 = campo(placar, nome(equipe2), salvo?.gols2)

    const areaPenaltis = document.createElement('div')
    areaPenaltis.className = 'area-sorteio'

    const ajuda = document.createElement('p')
    ajuda.textContent = 'Empate: informe o placar dos pênaltis.'

    const placarPenaltis = document.createElement('div')
    placarPenaltis.className = 'campos'

    const penaltis1 = campo(
      placarPenaltis, `Pênaltis — ${nome(equipe1)}`, salvo?.penaltis1,
    )

    const penaltis2 = campo(
      placarPenaltis, `Pênaltis — ${nome(equipe2)}`, salvo?.penaltis2,
    )

    areaPenaltis.append(ajuda, placarPenaltis)

    function atualizarPenaltis(): void {
      const empate = gols1.value !== ''
        && gols2.value !== ''
        && Number.isSafeInteger(gols1.valueAsNumber)
        && Number.isSafeInteger(gols2.valueAsNumber)
        && gols1.valueAsNumber >= 0
        && gols1.valueAsNumber === gols2.valueAsNumber

      areaPenaltis.hidden = !empate
      penaltis1.disabled = !empate
      penaltis2.disabled = !empate
      penaltis1.required = empate
      penaltis2.required = empate
    }

    gols1.addEventListener('input', atualizarPenaltis)
    gols2.addEventListener('input', atualizarPenaltis)
    atualizarPenaltis()

    const acoes = document.createElement('div')
    acoes.className = 'acoes'

    const botao = document.createElement('button')
    botao.type = 'submit'
    botao.className = 'botao'
    botao.textContent = salvo ? 'Atualizar resultado' : 'Salvar resultado'

    acoes.append(botao)
    campos.append(placar, areaPenaltis, acoes)
    formulario.append(campos)

    if (salvo) {
      const vencedor = document.createElement('p')
      vencedor.textContent = `Vencedor: ${nome(vencedorRegional(salvo))}`
      formulario.append(vencedor)
    }

    if (campos.disabled) {
      const bloqueio = document.createElement('p')
      bloqueio.className = 'ajuda'
      bloqueio.textContent =
        'Semifinal bloqueada: já existe resultado na final ou no terceiro lugar.'
      formulario.append(bloqueio)
    }

    conteudo.append(formulario)

    formulario.addEventListener('submit', async evento => {
      evento.preventDefault()
      if (salvando) return

      // Guarda o estado anterior para restaurar os bloqueios se houver erro.
      const estados = Array.from(
        conteudo.querySelectorAll('fieldset'),
      ).map(item => ({
        elemento: item,
        desabilitado: item.disabled,
      }))

      try {
        const resultado: ResultadoColonia = {
          jogo: confronto.numero,
          equipe1,
          equipe2,
          gols1: numero(gols1),
          gols2: numero(gols2),
        }

        if (resultado.gols1 === resultado.gols2) {
          resultado.penaltis1 = numero(penaltis1)
          resultado.penaltis2 = numero(penaltis2)

          if (resultado.penaltis1 === resultado.penaltis2) {
            throw new Error('Os pênaltis precisam definir um vencedor.')
          }
        }

        salvando = true
        fechar.disabled = true
        estados.forEach(item => {
          item.elemento.disabled = true
        })

        status.className = ''
        status.textContent = 'Salvando resultado...'

        await salvarResultadoColonia(
          competicaoId, resultado, competicao,
        )

        competicao.resultadosColonia = [
          ...(competicao.resultadosColonia ?? []).filter(
            item => item.jogo !== resultado.jogo,
          ),
          resultado,
        ]

        mostrarSemifinais(competicao.sorteioColonia!)
        status.textContent = `${confronto.titulo}: resultado salvo.`
      } catch (erro) {
        status.className = 'erro'
        status.textContent = erro instanceof Error
          ? erro.message
          : 'Não foi possível salvar o resultado.'
      } finally {
        salvando = false
        fechar.disabled = false

        estados.forEach(item => {
          item.elemento.disabled = item.desabilitado
        })
      }
    })
  }

  const final = resultadosSalvos.find(item => item.jogo === 4)
  const terceiro = resultadosSalvos.find(item => item.jogo === 3)

  if (final && terceiro) {
    function perdedor(resultado: ResultadoColonia): string {
      return vencedorRegional(resultado) === resultado.equipe1
        ? resultado.equipe2
        : resultado.equipe1
    }

    const titulo = document.createElement('h3')
    titulo.textContent = 'Classificação final'

    const lista = document.createElement('ol')
    const colocacoes = [
      vencedorRegional(final),
      perdedor(final),
      vencedorRegional(terceiro),
      perdedor(terceiro),
    ]

    for (const id of colocacoes) {
      const item = document.createElement('li')
      item.textContent = nome(id)
      lista.append(item)
    }

    conteudo.append(titulo, lista)
  }
}

  if (competicao.sorteioColonia) {
    mostrarSemifinais(competicao.sorteioColonia)
  } else {
    const ajuda = document.createElement('p')
    ajuda.className = 'ajuda'
    ajuda.textContent =
      'Informe os confrontos definidos no sorteio. Após confirmar, o sorteio e os resultados regionais ficam bloqueados nesta versão.'

    const formulario = document.createElement('form')
    const campos = document.createElement('fieldset')
    const seletores: HTMLSelectElement[] = []

    for (let indice = 0; indice < 4; indice++) {
      const rotulo = document.createElement('label')
      rotulo.className = 'campo'

      const texto = document.createElement('span')
      texto.textContent =
        `Semifinal ${Math.floor(indice / 2) + 1} — equipe ${indice % 2 + 1}`

      const seletor = document.createElement('select')
      seletor.required = true
      seletor.add(new Option('Selecione a equipe', ''))

      for (const id of classificados) {
        seletor.add(new Option(nome(id), id))
      }

      rotulo.append(texto, seletor)
      campos.append(rotulo)
      seletores.push(seletor)
    }

    function atualizarOpcoes(): void {
      const escolhidas = new Set(seletores.map(item => item.value))

      for (const seletor of seletores) {
        for (const opcao of Array.from(seletor.options)) {
          opcao.disabled = opcao.value !== ''
            && opcao.value !== seletor.value
            && escolhidas.has(opcao.value)
        }
      }
    }

    for (const seletor of seletores) {
      seletor.addEventListener('change', atualizarOpcoes)
    }

    const acoes = document.createElement('div')
    acoes.className = 'acoes'

    const salvar = document.createElement('button')
    salvar.className = 'botao'
    salvar.type = 'submit'
    salvar.textContent = 'Confirmar sorteio'

    acoes.append(salvar)
    campos.append(acoes)
    formulario.append(campos)
    conteudo.append(ajuda, formulario)

    formulario.addEventListener('submit', async evento => {
      evento.preventDefault()
      if (salvando) return

      const ordem = seletores.map(item => item.value)

      if (!sorteioColoniaValido(ordem, competicao)) {
        status.textContent = 'Selecione os quatro classificados sem repetir equipes.'
        status.className = 'erro'
        return
      }

      const confirmado = window.confirm(
        `Confirma estes confrontos?\n\n`
        + `Semifinal 1: ${nome(ordem[0]!)} × ${nome(ordem[1]!)}\n\n`
        + `Semifinal 2: ${nome(ordem[2]!)} × ${nome(ordem[3]!)}\n\n`
        + 'Nesta versão, o sorteio não poderá ser alterado após a confirmação.',
      )

      if (!confirmado) return

      salvando = true
      campos.disabled = true
      fechar.disabled = true
      status.className = ''
      status.textContent = 'Salvando sorteio...'

      try {
        await salvarSorteioColonia(competicaoId, ordem, resultados)
        competicao.sorteioColonia = [...ordem]
        mostrarSemifinais(ordem)
        status.textContent = 'Sorteio salvo.'
      } catch (erro) {
        status.className = 'erro'
        status.textContent = erro instanceof Error
          ? erro.message
          : 'Não foi possível salvar o sorteio.'
      } finally {
        salvando = false
        campos.disabled = false
        fechar.disabled = false
      }
    })
  }

  fechar.addEventListener('click', () => janela.close())

  janela.addEventListener('cancel', evento => {
    if (salvando) evento.preventDefault()
  })

  janela.addEventListener('close', () => janela.remove(), { once: true })

  document.body.append(janela)
  janela.showModal()
}