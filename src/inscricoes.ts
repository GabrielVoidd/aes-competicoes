import { listarCompeticoes, salvarInscricoes } from './banco'
import type { Competicao } from './banco'
import { copiarInscricoes, exigeAssociado, vinculos } from './regras-inscricoes'
import type { Atleta, Inscricoes, Responsavel } from './regras-inscricoes'

export async function abrirInscricoes(id: string): Promise<void> {
  const encontrada = (await listarCompeticoes()).find(c => c.id === id)
  if (!encontrada) throw new Error('Competição não encontrada.')
  let competicao: Competicao = encontrada
  let ocupado = false
  let editando: string | undefined
  const sujos = new Set<string>()
  const janela = document.createElement('dialog')
  janela.className = 'janela-equipes janela-inscricoes'
  janela.setAttribute('aria-labelledby', 'titulo-inscricoes')
  janela.innerHTML = `
    <div class="titulo-secao"><div><h2 id="titulo-inscricoes">Inscrições dos atletas</h2><p id="contexto-inscricoes"></p></div><button type="button" class="botao-secundario" id="fechar-inscricoes">Fechar</button></div>
    <p class="ajuda">Cadastre os atletas e o responsável por equipe. A idade é calculada pelo ano de nascimento. A inscrição ainda não comprova participação nos jogos nem autorização para atuar na colônia.</p>
    <p id="status-inscricoes" class="mensagem" role="status" aria-live="polite"></p>
    <section class="painel-inscricoes"><h3>Regras desta competição</h3>
      <form id="regras-inscricoes"><fieldset class="campos">
        <label class="campo">Ano de referência *<input name="anoReferencia" type="number" min="1900" max="9999" step="1" required></label>
        <label class="campo">Limite de atletas por equipe *<input name="limitePorEquipe" type="number" min="1" max="999" step="1" required></label>
        <label class="campo">Idade mínima no ano *<input name="idadeMinima" type="number" min="0" max="120" step="1" required></label>
        <div class="acoes campo-largo"><button class="botao" type="submit">Salvar regras</button><span class="ajuda">Master: mínimo de 40 anos. O limite inicial é 11.</span></div>
      </fieldset></form><p id="regra-salva" class="ajuda"></p>
    </section>
    <label class="campo">Equipe<select id="equipe-inscricoes"></select></label>
    <p id="resumo-inscricoes" class="ajuda"></p>
    <div id="formularios-inscricoes">
      <section class="painel-inscricoes"><h3>Responsável pela equipe</h3>
        <form id="responsavel-inscricoes"><fieldset class="campos">
          <label class="campo campo-largo">Nome completo *<input name="nome" maxlength="120" required></label>
          <label class="campo">Telefone / ramal *<input name="telefone" type="tel" maxlength="60" required></label>
          <label class="campo">E-mail *<input name="email" type="email" maxlength="160" required></label>
          <div class="acoes campo-largo"><button class="botao" type="submit">Salvar responsável</button></div>
        </fieldset></form>
      </section>
      <section class="painel-inscricoes"><h3 id="titulo-atleta">Novo atleta</h3>
        <form id="atleta-inscricoes"><fieldset class="campos">
          <label class="campo campo-largo">Nome completo *<input name="nome" maxlength="120" required></label>
          <label class="campo">Ano de nascimento *<input name="anoNascimento" type="number" min="1900" max="9999" step="1" required></label>
          <label class="campo">Tipo de identificação *<select name="tipoDocumento"><option>NIF</option><option>RG</option><option>CPF</option></select></label>
          <label class="campo">Número de identificação *<input name="documento" maxlength="40" required></label>
          <label class="campo">Vínculo *<select name="vinculo"></select></label>
          <label class="campo" id="origem-atleta">Unidade de origem *<input name="unidadeOrigem" maxlength="40"></label>
          <div id="associado-atleta" class="campos campo-largo">
            <label class="campo">Nome do associado relacionado *<input name="associadoNome" maxlength="120"></label>
            <label class="campo">Identificação do associado *<input name="associadoIdentificacao" maxlength="40"></label>
          </div>
          <div class="acoes campo-largo"><button class="botao" type="submit">Salvar atleta</button><button class="botao-secundario" type="button" id="limpar-atleta">Limpar / cancelar edição</button></div>
        </fieldset></form>
        <p class="ajuda">A repetição do mesmo tipo e número de documento é bloqueada entre inscrições ativas desta competição. Documentos de tipos diferentes exigem conferência pelo responsável.</p>
      </section>
    </div>
    <h3>Relação de inscritos</h3><p class="ajuda">O total de ativos e o responsável são apresentados por equipe. Inscrições canceladas ficam no histórico.</p>
    <div id="lista-inscricoes"></div>
  `
  function el<T extends HTMLElement>(seletor: string): T {
    const e = janela.querySelector<T>(seletor)
    if (!e) throw new Error(`Elemento não encontrado: ${seletor}`)
    return e
  }
  const regras = el<HTMLFormElement>('#regras-inscricoes')
  const contato = el<HTMLFormElement>('#responsavel-inscricoes')
  const atleta = el<HTMLFormElement>('#atleta-inscricoes')
  const equipe = el<HTMLSelectElement>('#equipe-inscricoes')
  const status = el<HTMLElement>('#status-inscricoes')
  function campo(form: HTMLFormElement, nome: string): HTMLInputElement | HTMLSelectElement {
    return form.elements.namedItem(nome) as HTMLInputElement | HTMLSelectElement
  }
  function ler(form: HTMLFormElement, nome: string): string { return campo(form, nome).value.trim() }
  function avisar(texto: string, erro = false) { status.textContent = texto; status.classList.toggle('mensagem-erro', erro) }
  function dados(): Inscricoes {
    if (!competicao.inscricoes) throw new Error('Salve primeiro as regras desta competição.')
    return copiarInscricoes(competicao.inscricoes)
  }
  async function salvar(novos: Inscricoes, parte: string, depois: () => void) {
    if (ocupado) return
    ocupado = true
    const controles = Array.from(janela.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button'))
    const estados = controles.map(c => c.disabled)
    controles.forEach(c => { c.disabled = true })
    avisar('Salvando...')
    try {
      competicao = await salvarInscricoes(id, novos, competicao.inscricoes)
      sujos.delete(parte)
      depois()
      mostrarLista()
      avisar('Dados salvos.')
    } catch (erro) { avisar(erro instanceof Error ? erro.message : 'Falha ao salvar.', true) }
    finally {
      controles.forEach((c, i) => { c.disabled = estados[i] ?? false })
      ocupado = false
      atualizarCampos()
    }
  }
  function executar(acao: () => void) {
    try { acao() } catch (erro) { avisar(erro instanceof Error ? erro.message : 'Confira os campos.', true) }
  }
  function atualizarCampos() {
    const vinculo = ler(atleta, 'vinculo')
    const outra = vinculo === 'De outra unidade'
    const associado = exigeAssociado(vinculo)
    el('#origem-atleta').hidden = !outra
    el('#associado-atleta').hidden = !associado
    for (const [nome, exigido] of [['unidadeOrigem', outra], ['associadoNome', associado], ['associadoIdentificacao', associado]] as const) {
      campo(atleta, nome).required = exigido
      campo(atleta, nome).disabled = !exigido || ocupado
    }
  }
  function limparAtleta() {
    editando = undefined; atleta.reset(); sujos.delete('atleta')
    el('#titulo-atleta').textContent = 'Novo atleta'; atualizarCampos()
  }
  function carregarEquipe() {
    contato.reset()
    const responsavel = competicao.inscricoes?.responsaveis.find(r => r.equipeId === equipe.value)
    if (responsavel) for (const nome of ['nome', 'telefone', 'email'] as const) campo(contato, nome).value = responsavel[nome]
    sujos.delete('contato'); limparAtleta(); mostrarLista()
    el('#formularios-inscricoes').hidden = !equipe.value
  }
  function mostrarLista() {
    const i = competicao.inscricoes
    el('#regra-salva').textContent = i
      ? `Regras salvas: ano ${i.anoReferencia}; até ${i.limitePorEquipe} atletas ativos por equipe; idade mínima ${i.idadeMinima}. Nascimento até ${i.anoReferencia - i.idadeMinima}.`
      : 'Regras ainda não salvas. Confirme o ano de referência antes de cadastrar atletas.'
    const todos = i?.atletas ?? []
    const selecionados = todos.filter(a => a.equipeId === equipe.value)
    const total = selecionados.filter(a => a.ativo).length
    el('#resumo-inscricoes').textContent = equipe.value
      ? `${total}/${i?.limitePorEquipe ?? 11} atletas ativos nesta equipe. Total na competição: ${todos.filter(a => a.ativo).length}. Responsável ${i?.responsaveis.some(r => r.equipeId === equipe.value) ? 'cadastrado' : 'pendente'}.`
      : 'Cadastre uma equipe em “Gerenciar equipes” para começar.'
    const lista = el('#lista-inscricoes'); lista.replaceChildren()
    if (!selecionados.length) { const p = document.createElement('p'); p.textContent = 'Nenhum atleta nesta equipe.'; lista.append(p) }
    for (const a of selecionados) {
      const linha = document.createElement('article'); linha.className = 'partida'
      const titulo = document.createElement('strong'); titulo.textContent = `${a.nome} — ${a.ativo ? 'Ativo' : 'Cancelado'}`
      const detalhe = document.createElement('p'); detalhe.textContent = `${a.anoNascimento} · ${a.tipoDocumento}: ${a.documento} · ${a.vinculo}`
      const acoes = document.createElement('div'); acoes.className = 'acoes'
      const editar = document.createElement('button'); editar.type = 'button'; editar.className = 'botao-secundario'; editar.textContent = 'Editar'
      editar.onclick = () => {
        if (ocupado || (sujos.has('atleta') && !window.confirm('Descartar os dados não salvos do formulário de atleta?'))) return
        limparAtleta(); editando = a.id
        for (const nome of ['nome', 'anoNascimento', 'tipoDocumento', 'documento', 'vinculo', 'unidadeOrigem', 'associadoNome', 'associadoIdentificacao'] as const) campo(atleta, nome).value = String(a[nome])
        el('#titulo-atleta').textContent = `Editar atleta${a.ativo ? '' : ' — inscrição cancelada'}`
        atualizarCampos(); campo(atleta, 'nome').focus()
      }
      const alternar = document.createElement('button'); alternar.type = 'button'; alternar.className = 'botao-secundario'; alternar.textContent = a.ativo ? 'Cancelar inscrição' : 'Reativar inscrição'
      alternar.onclick = () => executar(() => {
        if (ocupado || !window.confirm(`${a.ativo ? 'Cancelar' : 'Reativar'} a inscrição de ${a.nome}?`)) return
        const novos = dados(); novos.atletas = novos.atletas.map(item => item.id === a.id ? { ...item, ativo: !a.ativo } : item)
        void salvar(novos, 'estado', () => {})
      })
      acoes.append(editar, alternar); linha.append(titulo, detalhe, acoes); lista.append(linha)
    }
  }
  for (const [form, parte] of [[regras, 'regras'], [contato, 'contato'], [atleta, 'atleta']] as const) form.addEventListener('input', () => sujos.add(parte))
  campo(atleta, 'vinculo').addEventListener('change', atualizarCampos)
  const seletorVinculo = campo(atleta, 'vinculo') as HTMLSelectElement
  vinculos.forEach(v => seletorVinculo.add(new Option(v, v)))
  el('#contexto-inscricoes').textContent = `${competicao.nome} · ${competicao.categoria}`
  for (const e of competicao.equipes ?? []) equipe.add(new Option(`${e.nome} — ${e.unidade}`, e.id))
  let equipeAnterior = equipe.value
  equipe.onchange = () => {
    if ((sujos.has('atleta') || sujos.has('contato')) && !window.confirm('Descartar os dados não salvos do atleta e do responsável para trocar de equipe?')) { equipe.value = equipeAnterior; return }
    equipeAnterior = equipe.value; carregarEquipe()
  }
  const anoSugerido = /^\d{4}$/.test(competicao.edicao.trim()) ? competicao.edicao.trim() : competicao.data.slice(0, 4)
  campo(regras, 'anoReferencia').value = String(competicao.inscricoes?.anoReferencia ?? anoSugerido)
  campo(regras, 'limitePorEquipe').value = String(competicao.inscricoes?.limitePorEquipe ?? 11)
  campo(regras, 'idadeMinima').value = String(competicao.inscricoes?.idadeMinima ?? (/master/i.test(competicao.categoria) ? 40 : 0))
  regras.onsubmit = evento => { evento.preventDefault(); executar(() => {
    const novos = competicao.inscricoes ? dados() : { atletas: [], responsaveis: [], anoReferencia: 0, limitePorEquipe: 11, idadeMinima: 40 }
    novos.anoReferencia = Number(ler(regras, 'anoReferencia')); novos.limitePorEquipe = Number(ler(regras, 'limitePorEquipe')); novos.idadeMinima = Number(ler(regras, 'idadeMinima'))
    void salvar(novos, 'regras', () => {})
  }) }
  contato.onsubmit = evento => { evento.preventDefault(); executar(() => {
    const novos = dados()
    const r: Responsavel = { equipeId: equipe.value, nome: ler(contato, 'nome'), telefone: ler(contato, 'telefone'), email: ler(contato, 'email') }
    novos.responsaveis = [...novos.responsaveis.filter(item => item.equipeId !== equipe.value), r]
    void salvar(novos, 'contato', () => {})
  }) }
  atleta.onsubmit = evento => { evento.preventDefault(); executar(() => {
    const novos = dados()
    const anterior = novos.atletas.find(a => a.id === editando)
    const vinculo = ler(atleta, 'vinculo') as Atleta['vinculo']
    const a: Atleta = { id: editando ?? crypto.randomUUID(), equipeId: equipe.value, nome: ler(atleta, 'nome'), anoNascimento: Number(ler(atleta, 'anoNascimento')),
      tipoDocumento: ler(atleta, 'tipoDocumento') as Atleta['tipoDocumento'], documento: ler(atleta, 'documento'), vinculo,
      unidadeOrigem: vinculo === 'De outra unidade' ? ler(atleta, 'unidadeOrigem') : '',
      associadoNome: exigeAssociado(vinculo) ? ler(atleta, 'associadoNome') : '',
      associadoIdentificacao: exigeAssociado(vinculo) ? ler(atleta, 'associadoIdentificacao') : '', ativo: anterior?.ativo ?? true }
    novos.atletas = [...novos.atletas.filter(item => item.id !== a.id), a]
    void salvar(novos, 'atleta', limparAtleta)
  }) }
  el('#limpar-atleta').onclick = () => { if (!sujos.has('atleta') || window.confirm('Descartar os dados não salvos do atleta?')) limparAtleta() }
  function podeFechar() { return !ocupado && (!sujos.size || window.confirm('Fechar e descartar os campos que ainda não foram salvos?')) }
  el('#fechar-inscricoes').onclick = () => { if (podeFechar()) janela.close() }
  janela.addEventListener('cancel', evento => { evento.preventDefault(); if (podeFechar()) janela.close() })
  janela.addEventListener('close', () => janela.remove(), { once: true })
  carregarEquipe(); document.body.append(janela); janela.showModal()
}
