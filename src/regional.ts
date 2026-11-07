import { listarCompeticoes, salvarResultadoRegional } from './banco'
import {
  obterConfrontos,
  resultadosRegionaisValidos,
  vencedorRegional,
} from './regras-regionais'
import type { ResultadoRegional } from './regras-regionais'

export async function abrirRegional(competicaoId: string): Promise<void> {
  const registros = await listarCompeticoes()
  const encontrada = registros.find(item => item.id === competicaoId)

  if (!encontrada) {
    throw new Error('Competição não encontrada.')
  }

  const competicao = encontrada
  const confrontos = obterConfrontos(competicao)

  if (!resultadosRegionaisValidos(
    competicao.resultadosRegionais, competicao,
  )) {
    throw new Error('Existem resultados regionais inconsistentes.')
  }

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
  janela.setAttribute('aria-labelledby', 'titulo-regional')

  janela.innerHTML = `
    <div class="titulo-secao">
      <div>
        <h2 id="titulo-regional">Fase regional</h2>
        <p id="competicao-regional"></p>
      </div>
      <button id="fechar-regional" class="botao-secundario" type="button">
        Fechar
      </button>
    </div>

    <p class="ajuda">
      Os quatro vencedores seguem para a colônia.
      Em caso de empate, informe o placar dos pênaltis.
    </p>

    <p class="ajuda">
      Ao salvar o primeiro resultado regional, os resultados dos grupos
      e os sorteios da classificação ficam bloqueados.
    </p>

    <p id="status-regional" role="status" aria-live="polite"></p>
    <div id="confrontos-regionais"></div>

    <h3>Classificados para a colônia</h3>
    <ul id="classificados-colonia"></ul>
  `

  janela.querySelector('#competicao-regional')!.textContent =
    `${competicao.nome} · ${competicao.categoria}`

  const lista = janela.querySelector('#confrontos-regionais')!
  const classificados = janela.querySelector('#classificados-colonia')!
  const status = janela.querySelector<HTMLElement>('#status-regional')!
  const fechar = janela.querySelector<HTMLButtonElement>('#fechar-regional')!

  let salvando = false

  function mostrarClassificados(): void {
    classificados.replaceChildren()

    const resultados = [...(competicao.resultadosRegionais ?? [])]
      .sort((a, b) => a.jogo - b.jogo)

    if (resultados.length === 0) {
      const item = document.createElement('li')
      item.textContent = 'Nenhum classificado definido.'
      classificados.append(item)
      return
    }

    for (const resultado of resultados) {
      const item = document.createElement('li')
      item.textContent =
        `Jogo ${resultado.jogo}: ${nome(vencedorRegional(resultado))}`
      classificados.append(item)
    }
  }

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
      throw new Error('Preencha os placares com números inteiros, zero ou maiores.')
    }

    return valor
  }

  for (const confronto of confrontos) {
    const salvo = competicao.resultadosRegionais?.find(
      item => item.jogo === confronto.numero,
    )

    const formulario = document.createElement('form')
    formulario.className = 'partida'

    const titulo = document.createElement('h4')
    titulo.textContent = `Jogo regional ${confronto.numero}`

    const origem = document.createElement('p')
    origem.className = 'ajuda'
    origem.textContent = `${confronto.origem1} × ${confronto.origem2}`

    const campos = document.createElement('fieldset')
    const placar = document.createElement('div')
    placar.className = 'campos'

    const gols1 = campo(placar, nome(confronto.equipe1), salvo?.gols1)
    const gols2 = campo(placar, nome(confronto.equipe2), salvo?.gols2)

    const areaPenaltis = document.createElement('div')
    areaPenaltis.className = 'area-sorteio'

    const aviso = document.createElement('p')
    aviso.textContent = 'Empate: informe os gols convertidos nos pênaltis.'

    const placarPenaltis = document.createElement('div')
    placarPenaltis.className = 'campos'

    const penaltis1 = campo(
      placarPenaltis,
      `Pênaltis — ${nome(confronto.equipe1)}`,
      salvo?.penaltis1,
    )

    const penaltis2 = campo(
      placarPenaltis,
      `Pênaltis — ${nome(confronto.equipe2)}`,
      salvo?.penaltis2,
    )

    areaPenaltis.append(aviso, placarPenaltis)

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

    const vencedor = document.createElement('p')
    vencedor.className = 'ajuda'

    if (salvo) {
      vencedor.textContent =
        `Classificado: ${nome(vencedorRegional(salvo))}`
    }

    campos.append(placar, areaPenaltis, acoes)
    formulario.append(titulo, origem, campos, vencedor)
    lista.append(formulario)

    formulario.addEventListener('submit', async evento => {
      evento.preventDefault()
      if (salvando) return

      try {
        const resultado: ResultadoRegional = {
          jogo: confronto.numero,
          equipe1: confronto.equipe1,
          equipe2: confronto.equipe2,
          gols1: numero(gols1),
          gols2: numero(gols2),
        }

        if (resultado.gols1 === resultado.gols2) {
          resultado.penaltis1 = numero(penaltis1)
          resultado.penaltis2 = numero(penaltis2)

          if (resultado.penaltis1 === resultado.penaltis2) {
            throw new Error('O placar dos pênaltis precisa ter um vencedor.')
          }
        }

        salvando = true
        fechar.disabled = true

        janela.querySelectorAll('fieldset').forEach(item => {
          item.disabled = true
        })

        status.textContent = 'Salvando resultado...'
        status.className = ''

        await salvarResultadoRegional(
          competicaoId, resultado, competicao,
        )

        competicao.resultadosRegionais = [
          ...(competicao.resultadosRegionais ?? []).filter(
            item => item.jogo !== resultado.jogo,
          ),
          resultado,
        ]

        vencedor.textContent =
          `Classificado: ${nome(vencedorRegional(resultado))}`

        botao.textContent = 'Atualizar resultado'
        mostrarClassificados()
        status.textContent = `Resultado do jogo ${resultado.jogo} salvo.`
      } catch (erro) {
        status.className = 'erro'
        status.textContent = erro instanceof Error
          ? erro.message
          : 'Não foi possível salvar o resultado.'
      } finally {
        salvando = false
        fechar.disabled = false

        janela.querySelectorAll('fieldset').forEach(item => {
          item.disabled = false
        })
      }
    })
  }

  mostrarClassificados()

  fechar.addEventListener('click', () => janela.close())

  janela.addEventListener('cancel', evento => {
    if (salvando) evento.preventDefault()
  })

  janela.addEventListener('close', () => janela.remove(), { once: true })

  document.body.append(janela)
  janela.showModal()
}