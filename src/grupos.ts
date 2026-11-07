import { listarCompeticoes, salvarGrupos } from './banco'

export async function abrirGrupos(competicaoId: string): Promise<void> {
  const registros = await listarCompeticoes()
  const competicao = registros.find(item => item.id === competicaoId)

  if (!competicao) {
    throw new Error('Competição não encontrada.')
  }

  const equipes = competicao.equipes ?? []
  const janela = document.createElement('dialog')
  janela.className = 'janela-equipes'
  janela.setAttribute('aria-labelledby', 'titulo-grupos')

  janela.innerHTML = `
    <div class="titulo-secao">
      <div>
        <h2 id="titulo-grupos">Montar grupos</h2>
        <p id="competicao-grupos"></p>
      </div>
      <button id="fechar-grupos" class="botao-secundario" type="button">
        Fechar
      </button>
    </div>

    <p class="ajuda">
      Modelo com dois grupos de cinco equipes.
      Escolha cada equipe uma única vez.
      As posições determinam a sequência dos confrontos.
    </p>

    <form id="form-grupos">
      <fieldset id="campos-grupos" class="campos">
        <div id="grupo-1" class="coluna-grupo">
          <h3>Grupo 1</h3>
        </div>
        <div id="grupo-2" class="coluna-grupo">
          <h3>Grupo 2</h3>
        </div>

        <div class="acoes campo-largo">
          <button class="botao" type="submit">Salvar grupos</button>
        </div>
      </fieldset>
    </form>

    <p id="mensagem-grupos" class="mensagem"
      role="status" aria-live="polite"></p>
  `

  function buscar<T extends HTMLElement>(seletor: string): T {
    const elemento = janela.querySelector<T>(seletor)
    if (!elemento) throw new Error('Elemento não encontrado: ' + seletor)
    return elemento
  }

  buscar<HTMLParagraphElement>('#competicao-grupos').textContent =
    `${competicao.nome} · ${competicao.categoria}`

  const formulario = buscar<HTMLFormElement>('#form-grupos')
  const campos = buscar<HTMLFieldSetElement>('#campos-grupos')
  const fechar = buscar<HTMLButtonElement>('#fechar-grupos')
  const mensagem = buscar<HTMLParagraphElement>('#mensagem-grupos')
  const seletores: HTMLSelectElement[] = []

  let salvando = false

  for (const numero of [1, 2] as const) {
    const coluna = buscar<HTMLDivElement>(`#grupo-${numero}`)
    const salvos = numero === 1
      ? competicao.grupos?.grupo1
      : competicao.grupos?.grupo2

    for (let posicao = 0; posicao < 5; posicao++) {
      const campo = document.createElement('label')
      campo.className = 'campo'
      campo.append(document.createTextNode(`Posição ${posicao + 1}`))

      const seletor = document.createElement('select')
      seletor.name = `grupo${numero}-${posicao}`
      seletor.required = true
      seletor.append(new Option('Selecione uma equipe', ''))

      for (const equipe of equipes) {
        seletor.append(new Option(
          `${equipe.nome} — ${equipe.unidade}`,
          equipe.id,
        ))
      }

      seletor.value = salvos?.[posicao] ?? ''
      campo.append(seletor)
      coluna.append(campo)
      seletores.push(seletor)
    }
  }

  function atualizarOpcoes(): void {
    const escolhidas = new Set(
      seletores.map(seletor => seletor.value).filter(Boolean),
    )

    for (const seletor of seletores) {
      for (const opcao of Array.from(seletor.options)) {
        opcao.disabled = opcao.value !== ''
          && opcao.value !== seletor.value
          && escolhidas.has(opcao.value)
      }
    }
  }

  for (const seletor of seletores) {
    seletor.addEventListener('change', () => {
      atualizarOpcoes()
      mensagem.classList.remove('mensagem-erro')
      mensagem.textContent = 'Alterações ainda não salvas.'
    })
  }

  fechar.addEventListener('click', () => janela.close())

  janela.addEventListener('cancel', evento => {
    if (salvando) evento.preventDefault()
  })

  janela.addEventListener('close', () => janela.remove(), { once: true })

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault()
    if (salvando) return

    const ids = seletores.map(seletor => seletor.value)

    if (ids.some(id => !id) || new Set(ids).size !== 10) {
      mensagem.textContent = 'Selecione dez equipes diferentes.'
      mensagem.classList.add('mensagem-erro')
      return
    }

    salvando = true
    campos.disabled = true
    fechar.disabled = true
    mensagem.classList.remove('mensagem-erro')
    mensagem.textContent = 'Salvando grupos...'

    try {
      await salvarGrupos(competicaoId, {
        grupo1: ids.slice(0, 5),
        grupo2: ids.slice(5, 10),
      })

      mensagem.textContent = 'Grupos salvos com sucesso.'
    } catch (erro) {
      console.error(erro)
      mensagem.textContent = erro instanceof Error
        ? erro.message
        : 'Não foi possível salvar os grupos.'
      mensagem.classList.add('mensagem-erro')
    } finally {
      salvando = false
      campos.disabled = false
      fechar.disabled = false
    }
  })

  if (equipes.length !== 10) {
    campos.disabled = true
    mensagem.textContent =
      `Esta competição tem ${equipes.length} equipe(s). `
      + 'Este modelo exige exatamente dez.'
    mensagem.classList.add('mensagem-erro')
  } else if (competicao.grupos) {
    mensagem.textContent = 'Exibindo os grupos salvos.'
  }

  atualizarOpcoes()
  document.body.append(janela)
  janela.showModal()
}