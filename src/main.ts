import { abrirDamas } from './damas'
import { abrirConfraternizacao } from './confraternizacao'
import { abrirParticipacoes } from './participacoes'
import { abrirInscricoes } from './inscricoes'
import { abrirColonia } from './colonia'
import { abrirRegional } from './regional'
import { abrirClassificacao } from './classificacao'
import { abrirJogos } from './jogos'
import { abrirGrupos } from './grupos'
import { exportarBackup, lerBackup } from './backup'
import { importarCompeticoes } from './banco'
import './style.css'
import {
  modalidades,
  listarCompeticoes,
  salvarCompeticao,
} from './banco'
import type { Competicao, Modalidade } from './banco'
import { abrirEquipes } from './equipes'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Não foi encontrado o elemento #app.')
}

document.title = 'AES Competições'
document.documentElement.lang = 'pt-BR'

app.innerHTML = `
  <header class="cabecalho">
    <a class="marca" href="./" aria-label="AES Competições — início">
      <span class="marca-simbolo">AES</span>
      <span>Competições</span>
    </a>
    <span class="versao">Versão de teste</span>
  </header>

  <main class="conteudo">
    <section class="apresentacao">
      <p class="sobretitulo">ORGANIZAÇÃO ESPORTIVA</p>
      <h1>Suas competições.</h1>
      <p class="descricao">
        Cadastre um evento para começar a organizar os participantes.
      </p>
    </section>

    <section class="painel" aria-labelledby="titulo-cadastro">
      <h2 id="titulo-cadastro">Nova competição</h2>

      <form id="form-competicao">
        <fieldset id="campos-cadastro" class="campos">
          <label class="campo campo-largo">
            Nome da competição *
            <input name="nome" required maxlength="120"
              placeholder="Ex.: Festival de Futsal Master">
          </label>

          <label class="campo">
            Modalidade *
            <select name="modalidade" required>
              ${modalidades.map(nome =>
                `<option value="${nome}">${nome}</option>`,
              ).join('')}
            </select>
          </label>

          <label class="campo">
            Categoria *
            <input name="categoria" required maxlength="60"
              placeholder="Ex.: Master, Livre ou Veterano">
          </label>

          <label class="campo">
            Edição / ano *
            <input name="edicao" required maxlength="40"
              placeholder="Ex.: 2026">
          </label>

          <label class="campo">
            Data
            <input name="data" type="date">
          </label>

          <label class="campo campo-largo">
            Local
            <input name="local" maxlength="160"
              placeholder="Ex.: SESI Cotia">
          </label>

          <div class="acoes campo-largo">
            <button class="botao" type="submit">
              Salvar competição
            </button>
            <span class="ajuda">* Campos obrigatórios</span>
          </div>
        </fieldset>
      </form>

      <p id="mensagem" class="mensagem" role="status"
        aria-live="polite"></p>
    </section>
    
    <section class="painel" aria-labelledby="titulo-backup">
        <h2 id="titulo-backup">Backup dos cadastros</h2>

        <p class="ajuda">
            Salve uma cópia das competições para recuperar em outro navegador
            ou computador. O backup inclui competições, equipes, inscrições dos atletas, responsáveis, participações, exceções, grupos, resultados dos jogos, damas e confraternização.
        </p>

        <div class="acoes">
            <button id="exportar-backup" class="botao" type="button">
                Exportar backup
            </button>

            <button id="importar-backup" class="botao" type="button">
                Importar backup
            </button>

            <input id="arquivo-backup" type="file"
                accept=".json,application/json" hidden>
        </div>

        <p id="mensagem-backup" class="mensagem"
            role="status" aria-live="polite"></p>
    </section>

    <section aria-labelledby="titulo-lista">
      <div class="titulo-secao">
        <div>
          <h2 id="titulo-lista">Competições cadastradas</h2>
          <p>Dados salvos neste navegador.</p>
        </div>
        <span id="contador" class="contador"></span>
      </div>

      <div id="lista-competicoes" class="grade" aria-live="polite">
        <p>Carregando competições...</p>
      </div>
    </section>

    <footer class="rodape">
      O cadastro já funciona para todas as modalidades.
      Futsal e damas possuem organização de partidas. As outras modalidades serão ampliadas por etapas.
    </footer>
  </main>
`

function elemento<T extends HTMLElement>(seletor: string): T {
  const encontrado = document.querySelector<T>(seletor)

  if (!encontrado) {
    throw new Error('Elemento não encontrado: ' + seletor)
  }

  return encontrado
}

const formulario = elemento<HTMLFormElement>('#form-competicao')
const campos = elemento<HTMLFieldSetElement>('#campos-cadastro')
const mensagem = elemento<HTMLParagraphElement>('#mensagem')
const lista = elemento<HTMLDivElement>('#lista-competicoes')
const contador = elemento<HTMLSpanElement>('#contador')

let competicoes: Competicao[] = []

function avisar(texto: string, erro = false): void {
  mensagem.textContent = texto
  mensagem.classList.toggle('mensagem-erro', erro)
}

function criarTexto(
  tag: 'h3' | 'p' | 'span',
  texto: string,
  classe?: string,
): HTMLElement {
  const elemento = document.createElement(tag)
  elemento.textContent = texto
  if (classe) elemento.className = classe
  return elemento
}

function formatarData(data: string): string {
  if (!data) return 'Data a definir'
  return data.split('-').reverse().join('/')
}

function mostrarCompeticoes(): void {
  lista.replaceChildren()

  const quantidade = competicoes.length
  contador.textContent =
    `${quantidade} ${quantidade === 1 ? 'competição' : 'competições'}`

  if (quantidade === 0) {
    lista.append(criarTexto(
      'p',
      'Nenhuma competição cadastrada. Comece pelo formulário acima.',
      'vazio',
    ))
    return
  }

  for (const competicao of competicoes) {
    const cartao = document.createElement('article')
    cartao.className = 'cartao'

    // textContent permite exibir os nomes cadastrados sem interpretá-los como HTML.
    cartao.append(
      criarTexto('span', competicao.modalidade, 'status status-atual'),
      criarTexto('h3', competicao.nome),
      criarTexto(
        'p',
        `${competicao.categoria} · Edição ${competicao.edicao}`,
      ),
      criarTexto('p', formatarData(competicao.data)),
      criarTexto('p', competicao.local || 'Local a definir'),
    )

    const festa = document.createElement('button')
    festa.type = 'button'
    festa.className = 'botao-secundario'
    festa.textContent = 'Confraternização e hospedagem'
    festa.addEventListener('click', async () => {
      festa.disabled = true
      try { await abrirConfraternizacao(competicao.id) }
      catch (e) { window.alert(e instanceof Error ? e.message : 'Não foi possível abrir.') }
      finally { festa.disabled = false }
    })
    cartao.append(festa)

    if (competicao.modalidade === 'Damas') {
      const damas = document.createElement('button')
      damas.type = 'button'
      damas.className = 'botao'
      damas.textContent = 'Damas — inscrições e regional'
      damas.addEventListener('click', async () => {
        damas.disabled = true
        try { await abrirDamas(competicao.id) }
        catch (e) { window.alert(e instanceof Error ? e.message : 'Não foi possível abrir damas.') }
        finally { damas.disabled = false }
      })
      cartao.append(damas)
      if (competicao.damas) {
        const final = document.createElement('button')
        final.type = 'button'; final.className = 'botao-secundario'
        final.textContent = 'Damas — final na colônia'
        final.onclick = async () => {
          final.disabled = true
          try { await abrirDamas(competicao.id, 'final') }
          catch (e) { window.alert(e instanceof Error ? e.message : 'Não foi possível abrir a final.') }
          finally { final.disabled = false }
        }
        cartao.append(final)
      }
    }
    if (competicao.modalidade === 'Futsal') {
      const inscricoes = document.createElement('button')
      inscricoes.type = 'button'
      inscricoes.className = 'botao botao-equipes'
      inscricoes.textContent = 'Inscrições dos atletas'
      inscricoes.addEventListener('click', async () => {
        inscricoes.disabled = true
        try { await abrirInscricoes(competicao.id) }
        catch (erro) { window.alert(erro instanceof Error ? erro.message : 'Não foi possível abrir as inscrições.') }
        finally { inscricoes.disabled = false }
      })
      cartao.append(inscricoes)
      const participacoes = document.createElement('button')
      participacoes.type = 'button'
      participacoes.className = 'botao-secundario botao-grupos'
      participacoes.textContent = 'Participações e aptidão para a colônia'
      participacoes.addEventListener('click', async () => {
        participacoes.disabled = true
        try { await abrirParticipacoes(competicao.id) }
        catch (erro) { window.alert(erro instanceof Error ? erro.message : 'Não foi possível abrir as participações.') }
        finally { participacoes.disabled = false }
      })
      cartao.append(participacoes)


      const botaoEquipes = document.createElement('button')
      botaoEquipes.type = 'button'
      botaoEquipes.className = 'botao botao-equipes'
      botaoEquipes.textContent = 'Gerenciar equipes'

      botaoEquipes.addEventListener('click', async () => {
        botaoEquipes.disabled = true

        try {
          await abrirEquipes(competicao.id)
        } catch (erro) {
          console.error(erro)
          avisar('Não foi possível abrir as equipes. Tente novamente.', true)
        } finally {
          botaoEquipes.disabled = false
        }
      })

      const botaoGrupos = document.createElement('button')
      botaoGrupos.type = 'button'
      botaoGrupos.className = 'botao-secundario botao-grupos'
      botaoGrupos.textContent = 'Montar grupos'

      botaoGrupos.addEventListener('click', async () => {
        botaoGrupos.disabled = true

        try {
          await abrirGrupos(competicao.id)
        } catch (erro) {
          console.error(erro)
          avisar('Não foi possível abrir os grupos. Tente novamente.', true)
        } finally {
          botaoGrupos.disabled = false
        }
      })

      cartao.append(botaoGrupos)

      const botaoJogos = document.createElement('button')
      botaoJogos.type = 'button'
      botaoJogos.className = 'botao-secundario botao-grupos'
      botaoJogos.textContent = 'Ver jogos'

      botaoJogos.addEventListener('click', async () => {
        botaoJogos.disabled = true

        try {
          await abrirJogos(competicao.id)
        } catch (erro) {
          console.error(erro)

          window.alert(
              erro instanceof Error
                  ? erro.message
                  : 'Não foi possível abrir os jogos.',
          )
        } finally {
          botaoJogos.disabled = false
        }
      })

      cartao.append(botaoJogos)

      const botaoClassificacao = document.createElement('button')
      botaoClassificacao.type = 'button'
      botaoClassificacao.className = 'botao-secundario botao-grupos'
      botaoClassificacao.textContent = 'Ver classificação'

      botaoClassificacao.addEventListener('click', async () => {
        botaoClassificacao.disabled = true

        try {
          await abrirClassificacao(competicao.id)
        } catch (erro) {
          console.error(erro)

          window.alert(
              erro instanceof Error
                  ? erro.message
                  : 'Não foi possível abrir a classificação.',
          )
        } finally {
          botaoClassificacao.disabled = false
        }
      })

      cartao.append(botaoClassificacao)

      const botaoRegional = document.createElement('button')
      botaoRegional.type = 'button'
      botaoRegional.className = 'botao-secundario botao-grupos'
      botaoRegional.textContent = 'Ver fase regional'
      const botaoColonia = document.createElement('button')
      botaoColonia.type = 'button'
      botaoColonia.className = 'botao-secundario botao-grupos'
      botaoColonia.textContent = 'Ver etapa da colônia'

      botaoColonia.addEventListener('click', async () => {
        botaoColonia.disabled = true

        try {
          await abrirColonia(competicao.id)
        } catch (erro) {
          window.alert(
              erro instanceof Error
                  ? erro.message
                  : 'Não foi possível abrir a etapa da colônia.',
          )
        } finally {
          botaoColonia.disabled = false
        }
      })

      cartao.append(botaoColonia)

      botaoRegional.addEventListener('click', async () => {
        botaoRegional.disabled = true

        try {
          await abrirRegional(competicao.id)
        } catch (erro) {
          console.error(erro)

          window.alert(
              erro instanceof Error
                  ? erro.message
                  : 'Não foi possível abrir a fase regional.',
          )
        } finally {
          botaoRegional.disabled = false
        }
      })

      cartao.append(botaoRegional)

      cartao.append(botaoEquipes)
    }

    lista.append(cartao)
  }
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault()
  if (campos.disabled) return

  const dados = new FormData(formulario)
  const ler = (nome: string) => String(dados.get(nome) ?? '').trim()

  const nome = ler('nome')
  const categoria = ler('categoria')
  const edicao = ler('edicao')
  const modalidade = ler('modalidade')

  if (!nome || !categoria || !edicao) {
    avisar('Preencha nome, categoria e edição com um texto válido.', true)
    return
  }

  if (!modalidades.some(item => item === modalidade)) {
    avisar('Selecione uma modalidade válida.', true)
    return
  }

  const competicao: Competicao = {
    id: crypto.randomUUID(),
    nome,
    modalidade: modalidade as Modalidade,
    categoria,
    edicao,
    data: ler('data'),
    local: ler('local'),
    criadaEm: new Date().toISOString(),
  }

  campos.disabled = true
  avisar('Salvando...')

  try {
    await salvarCompeticao(competicao)
    competicoes.unshift(competicao)
    mostrarCompeticoes()
    formulario.reset()
    avisar('Competição salva com sucesso.')
  } catch (erro) {
    console.error(erro)
    avisar(
      'Não foi possível salvar. Seus campos foram mantidos para tentar novamente.',
      true,
    )
  } finally {
    campos.disabled = false
  }
})

async function iniciar(): Promise<void> {
  campos.disabled = true

  try {
    competicoes = await listarCompeticoes()
    mostrarCompeticoes()
    campos.disabled = false
  } catch (erro) {
    console.error(erro)
    lista.textContent = 'Não foi possível carregar as competições.'
    avisar(
      'O armazenamento não está disponível. Recarregue a página para tentar novamente.',
      true,
    )
  }
}

void iniciar()

const botaoExportar = elemento<HTMLButtonElement>('#exportar-backup')
const botaoImportar = elemento<HTMLButtonElement>('#importar-backup')
const arquivoBackup = elemento<HTMLInputElement>('#arquivo-backup')
const mensagemBackup = elemento<HTMLParagraphElement>('#mensagem-backup')

function avisarBackup(texto: string, erro = false): void {
  mensagemBackup.textContent = texto
  mensagemBackup.classList.toggle('mensagem-erro', erro)
}

function bloquearBackup(bloqueado: boolean): void {
  botaoExportar.disabled = bloqueado
  botaoImportar.disabled = bloqueado
}

botaoExportar.addEventListener('click', async () => {
  bloquearBackup(true)

  try {
    await exportarBackup()
    avisarBackup('Download solicitado. Confira o arquivo na pasta de downloads.')
  } catch (erro) {
    console.error(erro)
    avisarBackup('Não foi possível exportar o backup. Tente novamente.', true)
  } finally {
    bloquearBackup(false)
  }
})

botaoImportar.addEventListener('click', () => {
  arquivoBackup.click()
})

arquivoBackup.addEventListener('change', async () => {
  const arquivo = arquivoBackup.files?.[0]
  if (!arquivo) return

  bloquearBackup(true)
  avisarBackup('Verificando arquivo...')

  let gravou = false

  try {
    const registros = await lerBackup(arquivo)

    const confirmar = window.confirm(
      `O backup contém ${registros.length} competição(ões).\n\n`
      + 'Serão adicionadas apenas as que ainda não existem pelo identificador. '
      + 'As versões locais serão preservadas.\n\n'
      + 'Deseja continuar?',
    )

    if (!confirmar) {
      avisarBackup('Importação cancelada.')
      return
    }

    const adicionadas = await importarCompeticoes(registros)
    gravou = true

    competicoes = await listarCompeticoes()
    mostrarCompeticoes()

    avisarBackup(
      `${adicionadas} competição(ões) adicionada(s). `
      + `${registros.length - adicionadas} já existente(s), preservada(s).`,
    )
  } catch (erro) {
    console.error(erro)

    avisarBackup(
      gravou
        ? 'O backup foi importado, mas a lista não atualizou. Recarregue a página.'
        : erro instanceof Error
          ? erro.message
          : 'Não foi possível importar o backup.',
      true,
    )
  } finally {
    arquivoBackup.value = ''
    bloquearBackup(false)
  }
})