import { adicionarEquipe, listarCompeticoes } from './banco'
import type { Competicao } from './banco'

export async function abrirEquipes(competicaoId: string): Promise<void> {
  const registros = await listarCompeticoes()
  const encontrada = registros.find(item => item.id === competicaoId)

  if (!encontrada) {
    throw new Error('Competição não encontrada.')
  }

  let competicao: Competicao = encontrada

  const janela = document.createElement('dialog')
  janela.className = 'janela-equipes'
  janela.setAttribute('aria-labelledby', 'titulo-equipes')

  janela.innerHTML = `
    <div class="titulo-secao">
      <div>
        <h2 id="titulo-equipes">Equipes inscritas</h2>
        <p id="nome-competicao"></p>
      </div>
      <button type="button" id="fechar-equipes" class="botao-secundario">
        Fechar
      </button>
    </div>

    <form id="form-equipe">
      <fieldset id="campos-equipe" class="campos">
        <label class="campo">
          Nome da equipe *
          <input name="nome" required maxlength="100"
            placeholder="Ex.: CHARURI GRU">
        </label>

        <label class="campo">
          Unidade / CFP *
          <input name="unidade" required maxlength="40"
            placeholder="Ex.: 1.28">
        </label>

        <div class="acoes campo-largo">
          <button type="submit" class="botao">Adicionar equipe</button>
        </div>
      </fieldset>
    </form>

    <p id="mensagem-equipe" class="mensagem" role="status"></p>

    <div class="titulo-secao espacamento-equipes">
      <h3>Equipes desta competição</h3>
      <span id="total-equipes" class="contador"></span>
    </div>

    <ul id="lista-equipes" class="lista-equipes"></ul>
  `

  function buscar<T extends HTMLElement>(seletor: string): T {
    const item = janela.querySelector<T>(seletor)
    if (!item) throw new Error('Elemento não encontrado: ' + seletor)
    return item
  }

  const formulario = buscar<HTMLFormElement>('#form-equipe')
  const campos = buscar<HTMLFieldSetElement>('#campos-equipe')
  const mensagem = buscar<HTMLParagraphElement>('#mensagem-equipe')
  const lista = buscar<HTMLUListElement>('#lista-equipes')
  const total = buscar<HTMLSpanElement>('#total-equipes')
  const fechar = buscar<HTMLButtonElement>('#fechar-equipes')

  buscar<HTMLParagraphElement>('#nome-competicao').textContent =
    `${competicao.nome} · ${competicao.categoria}`

  let salvando = false

  function mostrar(): void {
    const equipes = competicao.equipes ?? []
    lista.replaceChildren()
    total.textContent = `${equipes.length} equipe(s)`

    if (equipes.length === 0) {
      const vazio = document.createElement('li')
      vazio.className = 'vazio'
      vazio.textContent = 'Nenhuma equipe cadastrada nesta competição.'
      lista.append(vazio)
      return
    }

    for (const equipe of equipes) {
      const linha = document.createElement('li')
      linha.className = 'linha-equipe'

      const nome = document.createElement('strong')
      nome.textContent = equipe.nome

      const unidade = document.createElement('span')
      unidade.textContent = `Unidade / CFP: ${equipe.unidade}`

      linha.append(nome, unidade)
      lista.append(linha)
    }
  }

  fechar.addEventListener('click', () => janela.close())

  janela.addEventListener('cancel', evento => {
    if (salvando) evento.preventDefault()
  })

  janela.addEventListener('close', () => janela.remove(), { once: true })

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault()
    if (salvando) return

    const dados = new FormData(formulario)
    const nome = String(dados.get('nome') ?? '').trim()
    const unidade = String(dados.get('unidade') ?? '').trim()

    mensagem.classList.remove('mensagem-erro')

    if (!nome || !unidade) {
      mensagem.textContent = 'Preencha o nome da equipe e a unidade.'
      mensagem.classList.add('mensagem-erro')
      return
    }

    salvando = true
    campos.disabled = true
    fechar.disabled = true
    mensagem.textContent = 'Salvando equipe...'

    try {
      competicao = await adicionarEquipe(competicaoId, {
        id: crypto.randomUUID(),
        nome,
        unidade,
      })

      mostrar()
      formulario.reset()
      mensagem.textContent = 'Equipe adicionada com sucesso.'
    } catch (erro) {
      console.error(erro)
      mensagem.textContent = erro instanceof Error
        ? erro.message
        : 'Não foi possível salvar a equipe.'
      mensagem.classList.add('mensagem-erro')
    } finally {
      salvando = false
      campos.disabled = false
      fechar.disabled = false
    }
  })

  mostrar()
  document.body.append(janela)
  janela.showModal()
}