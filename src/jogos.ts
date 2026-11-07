import { listarCompeticoes, salvarResultado } from './banco'
import { participantesDoJogo, temDependentes } from './futsal'
import type { ResultadoFutsal } from './futsal'

export async function abrirJogos(competicaoId: string): Promise<void> {
  const registros = await listarCompeticoes()
  const competicao = registros.find(item => item.id === competicaoId)

  if (!competicao || competicao.modalidade !== 'Futsal') {
    throw new Error('Competição de futsal não encontrada.')
  }

  const grupos = competicao.grupos

  if (!grupos) {
    throw new Error('Monte e salve os grupos antes de abrir os jogos.')
  }

  const equipes = competicao.equipes ?? []
  const porId = new Map(equipes.map(equipe => [equipe.id, equipe]))
  const ids = [...grupos.grupo1, ...grupos.grupo2]

  if (
    equipes.length !== 10
    || grupos.grupo1.length !== 5
    || grupos.grupo2.length !== 5
    || new Set(ids).size !== 10
    || ids.some(id => !porId.has(id))
  ) {
    throw new Error('Revise e salve os grupos antes de abrir os jogos.')
  }

  let resultados = competicao.resultados ?? []
  let salvando = false

  const janela = document.createElement('dialog')
  janela.className = 'janela-equipes janela-jogos'
  janela.setAttribute('aria-labelledby', 'titulo-jogos')

  janela.innerHTML = `
    <div class="titulo-secao">
      <div>
        <h2 id="titulo-jogos">Jogos e resultados</h2>
        <p id="competicao-jogos"></p>
      </div>
      <button id="fechar-jogos" class="botao-secundario" type="button">
        Fechar
      </button>
    </div>

    <p class="ajuda">
      Nos jogos 1 e 2, um empate exige registrar o sorteio
      que define as posições dos próximos confrontos.
      O resultado esportivo continua sendo empate.
    </p>

    <p id="mensagem-jogos" class="mensagem" role="status"
      aria-live="polite"></p>

    <div id="conteudo-jogos"></div>
  `

  function buscar<T extends HTMLElement>(seletor: string): T {
    const item = janela.querySelector<T>(seletor)
    if (!item) throw new Error('Elemento não encontrado: ' + seletor)
    return item
  }

  const conteudo = buscar<HTMLDivElement>('#conteudo-jogos')
  const mensagem = buscar<HTMLParagraphElement>('#mensagem-jogos')
  const fechar = buscar<HTMLButtonElement>('#fechar-jogos')

  buscar<HTMLParagraphElement>('#competicao-jogos').textContent =
    `${competicao.nome} · ${competicao.categoria}`

  function avisar(texto: string, erro = false): void {
    mensagem.textContent = texto
    mensagem.classList.toggle('mensagem-erro', erro)
  }

  function nome(id: string | undefined, pendente: string): string {
    if (!id) return pendente
    const equipe = porId.get(id)
    return equipe ? `${equipe.nome} — ${equipe.unidade}` : 'Equipe não encontrada'
  }

  function mostrar(): void {
    conteudo.replaceChildren()

    for (const grupo of [1, 2] as const) {
      const participantes = grupo === 1 ? grupos!.grupo1 : grupos!.grupo2

      const titulo = document.createElement('h3')
      titulo.className = 'titulo-grupo-jogos'
      titulo.textContent = `Grupo ${grupo}`
      conteudo.append(titulo)

      for (let jogo = 1; jogo <= 5; jogo++) {
        const [id1, id2] = participantesDoJogo(
          participantes, resultados, grupo, jogo,
        )

        const salvo = resultados.find(
          item => item.grupo === grupo && item.jogo === jogo,
        )

        const pendente1 = jogo === 4
          ? 'Perdedor do jogo 2'
          : jogo === 5 ? 'Vencedor do jogo 2' : 'Equipe a definir'

        const pendente2 = jogo === 3
          ? 'Perdedor do jogo 1'
          : jogo === 4 ? 'Vencedor do jogo 1' : 'Equipe a definir'

        const formulario = document.createElement('form')
        formulario.className = 'partida'

        formulario.innerHTML = `
          <h4>Jogo ${jogo}</h4>

          <fieldset class="campos campos-partida">
            <label class="campo">
              <span class="nome-equipe-1"></span>
              <input name="gols1" type="number" min="0" step="1"
                required aria-label="Gols da primeira equipe">
            </label>

            <label class="campo">
              <span class="nome-equipe-2"></span>
              <input name="gols2" type="number" min="0" step="1"
                required aria-label="Gols da segunda equipe">
            </label>

            <div class="area-sorteio campo-largo" hidden>
              <label class="campo">
                Equipe sorteada para a posição de perdedor
                <select name="perdedor">
                  <option value="">Selecione o resultado do sorteio</option>
                </select>
              </label>
              <p class="ajuda">
                Registre aqui o sorteio realizado pela organização.
              </p>
            </div>

            <div class="acoes campo-largo">
              <button class="botao" type="submit">
                ${salvo ? 'Salvar correção' : 'Salvar resultado'}
              </button>
            </div>
          </fieldset>

          <p class="situacao-partida ajuda"></p>
        `

        const campos = formulario.querySelector<HTMLFieldSetElement>('fieldset')!
        const gols1 = formulario.querySelector<HTMLInputElement>('[name="gols1"]')!
        const gols2 = formulario.querySelector<HTMLInputElement>('[name="gols2"]')!
        const sorteio = formulario.querySelector<HTMLSelectElement>('[name="perdedor"]')!
        const areaSorteio = formulario.querySelector<HTMLDivElement>('.area-sorteio')!
        const situacao = formulario.querySelector<HTMLParagraphElement>('.situacao-partida')!

        formulario.querySelector('.nome-equipe-1')!.textContent = nome(id1, pendente1)
        formulario.querySelector('.nome-equipe-2')!.textContent = nome(id2, pendente2)

        if (id1) sorteio.append(new Option(nome(id1, ''), id1))
        if (id2) sorteio.append(new Option(nome(id2, ''), id2))

        if (salvo) {
          gols1.value = String(salvo.gols1)
          gols2.value = String(salvo.gols2)
          sorteio.value = salvo.perdedorSorteado ?? ''
        }

        function atualizarSorteio(): void {
          const empatado = jogo <= 2
            && gols1.value !== ''
            && gols2.value !== ''
            && gols1.valueAsNumber === gols2.valueAsNumber

          areaSorteio.hidden = !empatado
          sorteio.required = empatado
        }

        gols1.addEventListener('input', atualizarSorteio)
        gols2.addEventListener('input', atualizarSorteio)
        atualizarSorteio()

        const bloqueado = temDependentes(resultados, grupo, jogo)
        campos.disabled = !id1 || !id2 || bloqueado

        situacao.textContent = !id1 || !id2
          ? 'Aguardando os resultados dos jogos anteriores.'
          : bloqueado
            ? 'Resultado salvo. Correção bloqueada porque há jogos dependentes registrados.'
            : salvo ? 'Resultado salvo.' : 'Resultado ainda não registrado.'

        formulario.addEventListener('submit', async evento => {
          evento.preventDefault()
          if (salvando || campos.disabled) return

          const primeiro = gols1.valueAsNumber
          const segundo = gols2.valueAsNumber

          if (
            !Number.isSafeInteger(primeiro) || primeiro < 0
            || !Number.isSafeInteger(segundo) || segundo < 0
          ) {
            avisar('Informe placares inteiros e não negativos.', true)
            return
          }

          const resultado: ResultadoFutsal = {
            grupo,
            jogo,
            gols1: primeiro,
            gols2: segundo,
          }

          if (jogo <= 2 && primeiro === segundo) {
            if (!sorteio.value) {
              avisar('Registre o resultado do sorteio.', true)
              return
            }
            resultado.perdedorSorteado = sorteio.value
          }

          salvando = true
          fechar.disabled = true

          const estados = Array.from(
            conteudo.querySelectorAll<HTMLFieldSetElement>('fieldset'),
          ).map(campo => ({ campo, disabled: campo.disabled }))

          for (const estado of estados) estado.campo.disabled = true

          avisar('Salvando resultado...')

          try {
            await salvarResultado(competicaoId, resultado, grupos!)

            resultados = resultados.filter(
              item => item.grupo !== grupo || item.jogo !== jogo,
            )
            resultados.push(resultado)

            mostrar()
            avisar('Resultado salvo. Os próximos confrontos foram atualizados.')
          } catch (erro) {
            console.error(erro)

            for (const estado of estados) {
              estado.campo.disabled = estado.disabled
            }

            avisar(
              erro instanceof Error ? erro.message : 'Não foi possível salvar.',
              true,
            )
          } finally {
            salvando = false
            fechar.disabled = false
          }
        })

        conteudo.append(formulario)
      }
    }
  }

  fechar.addEventListener('click', () => janela.close())

  janela.addEventListener('cancel', evento => {
    if (salvando) evento.preventDefault()
  })

  janela.addEventListener('close', () => janela.remove(), { once: true })

  mostrar()
  document.body.append(janela)
  janela.showModal()
}