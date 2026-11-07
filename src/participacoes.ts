import { listarCompeticoes, salvarParticipacoes } from './banco'
import type { Competicao } from './banco'
import { copiarParticipacoes, partidasParaParticipacao, participacoesValidas, situacaoColonia } from './regras-participacoes'
import type { Participacoes, ExcecaoColonia } from './regras-participacoes'

export async function abrirParticipacoes(id: string): Promise<void> {
  const encontrada = (await listarCompeticoes()).find(c => c.id === id)
  if (!encontrada) throw new Error('Competição não encontrada.')
  let competicao: Competicao = encontrada
  if (!participacoesValidas(competicao.participacoes, competicao)) throw new Error('Existem participações inconsistentes no cadastro.')
  const partidas = partidasParaParticipacao(competicao)
  const janela = document.createElement('dialog')
  janela.className = 'janela-equipes janela-inscricoes'
  janela.setAttribute('aria-labelledby', 'titulo-participacoes')
  janela.innerHTML = `
    <div class="titulo-secao"><div><h2 id="titulo-participacoes">Participações e colônia</h2><p id="contexto-participacoes"></p></div><button type="button" class="botao-secundario" id="fechar-participacoes">Fechar</button></div>
    <p class="ajuda">Um jogo dos grupos ou da regional já atende ao requisito de atuação. Para estar apto, o atleta também precisa de inscrição ativa e equipe classificada. Sem atuação, registre uma exceção médica ou de trabalho.</p>
    <p id="status-participacoes" class="mensagem" role="status" aria-live="polite"></p>
    <section class="painel-inscricoes"><h3>Quem efetivamente jogou</h3>
      <p class="ajuda">São exibidas somente partidas com resultado salvo. Marque quem entrou em jogo, não apenas quem estava inscrito. Salvar substitui a lista de atuação desta partida; as demais partidas são preservadas.</p>
      <label class="campo">Partida<select id="partida-participacao"></select></label>
      <form id="form-atuacao"><div id="atletas-partida"></div><div class="acoes"><button class="botao" type="submit" id="salvar-atuacao">Salvar participação nesta partida</button></div></form>
    </section>
    <section class="painel-inscricoes"><h3>Exceção para a colônia</h3>
      <p class="ajuda">Registre apenas liberações conferidas pela organização. Não é necessário informar diagnóstico médico. O nome abaixo identifica quem confirmou a liberação; este protótipo não possui autenticação nem valida documentos.</p>
      <label class="campo">Atleta<select id="atleta-excecao"></select></label>
      <p id="situacao-excecao" class="ajuda"></p>
      <form id="form-excecao"><fieldset class="campos">
        <label class="campo">Motivo *<select name="motivo"><option value="medico">Atestado médico</option><option value="trabalho">Motivo de trabalho</option></select></label>
        <label class="campo">Responsável pela liberação *<input name="responsavel" maxlength="120" required></label>
        <label class="campo campo-largo">Justificativa *<textarea name="justificativa" rows="3" maxlength="1000" required></textarea></label>
        <div class="acoes campo-largo"><button class="botao" type="submit">Salvar / ativar exceção</button><button class="botao-secundario" id="revogar-excecao" type="button">Revogar exceção</button></div>
      </fieldset></form>
    </section>
    <h3>Conferência para a colônia</h3>
    <label class="campo">Filtrar equipe<select id="filtro-participacoes"><option value="">Todas as equipes</option></select></label>
    <p id="total-aptos" class="ajuda"></p><div id="lista-aptidao"></div>
    <p class="ajuda">Esta consulta ajuda a conferir quem pode atuar. O lançamento dos placares continua sendo por equipe e não comprova quais atletas jogaram na colônia.</p>
  `
  function el<T extends HTMLElement>(seletor: string): T {
    const item = janela.querySelector<T>(seletor)
    if (!item) throw new Error(`Elemento não encontrado: ${seletor}`)
    return item
  }
  const jogo = el<HTMLSelectElement>('#partida-participacao')
  const pessoa = el<HTMLSelectElement>('#atleta-excecao')
  const filtro = el<HTMLSelectElement>('#filtro-participacoes')
  const atuacaoForm = el<HTMLFormElement>('#form-atuacao')
  const excecaoForm = el<HTMLFormElement>('#form-excecao')
  const status = el('#status-participacoes')
  const sujos = new Set<string>()
  let salvando = false
  function nomeEquipe(id: string) { const e = competicao.equipes?.find(e => e.id === id); return e ? `${e.nome} — ${e.unidade}` : 'Equipe não encontrada' }
  function campo(nome: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement { return excecaoForm.elements.namedItem(nome) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement }
  function avisar(texto: string, erro = false) { status.textContent = texto; status.classList.toggle('mensagem-erro', erro) }
  function dados(): Participacoes { return copiarParticipacoes(competicao.participacoes ?? { atuacoes: [], excecoes: [] }) }
  function confirmarDescarte(parte: string) { return !sujos.has(parte) || window.confirm('Descartar as alterações ainda não salvas deste formulário? Os registros já salvos serão mantidos.') }
  async function salvar(novos: Participacoes, parte: string, depois: () => void) {
    if (salvando) return
    salvando = true
    const controles = Array.from(janela.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement | HTMLTextAreaElement>('input,select,button,textarea'))
    const estados = controles.map(c => c.disabled)
    controles.forEach(c => { c.disabled = true })
    avisar('Salvando...')
    try {
      competicao = await salvarParticipacoes(id, novos, competicao)
      sujos.delete(parte); depois(); mostrarSituacoes()
      avisar('Registro salvo. Os demais formulários só são gravados pelos respectivos botões.')
    } catch (erro) { avisar(erro instanceof Error ? erro.message : 'Falha ao salvar.', true) }
    finally {
      controles.forEach((c, i) => { c.disabled = estados[i] ?? false }); salvando = false
      atualizarBotoes()
    }
  }
  function atualizarBotoes() {
    el<HTMLButtonElement>('#salvar-atuacao').disabled = salvando || !jogo.value
    const registro = competicao.participacoes?.excecoes.find(e => e.atletaId === pessoa.value)
    el<HTMLButtonElement>('#revogar-excecao').disabled = salvando || !registro?.ativa
    el<HTMLFieldSetElement>('#form-excecao fieldset').disabled = salvando || !pessoa.value
  }
  function mostrarAtuacao() {
    const area = el('#atletas-partida'); area.replaceChildren()
    const partida = partidas.find(p => p.chave === jogo.value)
    if (!partida) { area.textContent = 'Salve um resultado nos jogos dos grupos ou da regional para registrar a participação.'; atualizarBotoes(); return }
    const salvo = competicao.participacoes?.atuacoes.find(a => a.partida === partida.chave)
    const aviso = document.createElement('p'); aviso.className = 'ajuda'
    aviso.textContent = salvo ? `Participação informada: ${salvo.atletas.length} atleta(s). Última alteração: ${new Date(salvo.atualizadaEm).toLocaleString('pt-BR')}.` : 'Participação ainda não informada. Ausência de marcação não comprova que o atleta não jogou.'
    area.append(aviso)
    for (const equipeId of [partida.equipe1, partida.equipe2]) {
      const grupo = document.createElement('fieldset'); grupo.className = 'lista-presencas'
      const titulo = document.createElement('legend'); titulo.textContent = nomeEquipe(equipeId); grupo.append(titulo)
      const atletas = (competicao.inscricoes?.atletas ?? []).filter(a => a.equipeId === equipeId)
      if (!atletas.length) { const p = document.createElement('p'); p.textContent = 'Nenhum atleta inscrito nesta equipe. Cadastre em Inscrições dos atletas.'; grupo.append(p) }
      for (const a of atletas) {
        const rotulo = document.createElement('label'); rotulo.className = 'linha-presenca'
        const input = document.createElement('input'); input.type = 'checkbox'; input.value = a.id; input.name = 'atleta'
        input.checked = salvo?.atletas.includes(a.id) ?? false
        input.disabled = !a.ativo && !input.checked
        const texto = document.createElement('span'); texto.textContent = `${a.nome} · ${a.tipoDocumento} ${a.documento}${a.ativo ? '' : ' — inscrição cancelada'}`
        input.onchange = () => sujos.add('atuacao')
        rotulo.append(input, texto); grupo.append(rotulo)
      }
      area.append(grupo)
    }
    sujos.delete('atuacao'); atualizarBotoes()
  }
  function mostrarExcecao() {
    excecaoForm.reset()
    const salvo = competicao.participacoes?.excecoes.find(e => e.atletaId === pessoa.value)
    if (salvo) for (const chave of ['motivo', 'responsavel', 'justificativa'] as const) campo(chave).value = salvo[chave]
    el('#situacao-excecao').textContent = salvo
      ? `Exceção ${salvo.ativa ? 'ativa' : 'revogada'} · última alteração: ${new Date(salvo.atualizadaEm).toLocaleString('pt-BR')}.`
      : pessoa.value ? 'Nenhuma exceção registrada para este atleta.' : 'Cadastre atletas antes de registrar uma exceção.'
    sujos.delete('excecao'); atualizarBotoes()
  }
  function mostrarSituacoes() {
    const area = el('#lista-aptidao'); area.replaceChildren()
    const atletas = (competicao.inscricoes?.atletas ?? []).filter(a => !filtro.value || a.equipeId === filtro.value)
    let aptos = 0
    for (const a of atletas) {
      const situacao = situacaoColonia(competicao, a)
      if (situacao.apto) aptos++
      const cartao = document.createElement('article'); cartao.className = 'partida'
      const titulo = document.createElement('strong'); titulo.textContent = `${a.nome} · ${nomeEquipe(a.equipeId)}`
      const estado = document.createElement('p'); estado.textContent = situacao.motivo
      const historico = document.createElement('p'); historico.className = 'ajuda'
      historico.textContent = situacao.jogos.length ? `Atuou em: ${situacao.jogos.map(chave => partidas.find(p => p.chave === chave)?.titulo ?? chave).join('; ')}.` : 'Nenhuma atuação registrada nos grupos ou na regional.'
      const excecao = competicao.participacoes?.excecoes.find(e => e.atletaId === a.id)
      cartao.append(titulo, estado, historico)
      if (excecao) { const p = document.createElement('p'); p.className = 'ajuda'; p.textContent = `Exceção ${excecao.ativa ? 'ativa' : 'revogada'}: ${excecao.motivo === 'medico' ? 'médica' : 'trabalho'} · ${excecao.justificativa} · responsável: ${excecao.responsavel}.`; cartao.append(p) }
      area.append(cartao)
    }
    el('#total-aptos').textContent = `${aptos} apto(s) entre ${atletas.length} inscrição(ões) no filtro atual.`
    if (!atletas.length) area.textContent = 'Nenhum atleta cadastrado neste filtro.'
  }
  el('#contexto-participacoes').textContent = `${competicao.nome} · ${competicao.categoria}`
  for (const p of partidas) jogo.add(new Option(`${p.titulo}: ${nomeEquipe(p.equipe1)} × ${nomeEquipe(p.equipe2)}`, p.chave))
  for (const a of competicao.inscricoes?.atletas ?? []) pessoa.add(new Option(`${a.nome} · ${nomeEquipe(a.equipeId)}${a.ativo ? '' : ' (cancelado)'}`, a.id))
  for (const e of competicao.equipes ?? []) filtro.add(new Option(nomeEquipe(e.id), e.id))
  let jogoAnterior = jogo.value; let pessoaAnterior = pessoa.value
  jogo.onchange = () => { if (!confirmarDescarte('atuacao')) { jogo.value = jogoAnterior; return }; jogoAnterior = jogo.value; mostrarAtuacao() }
  pessoa.onchange = () => { if (!confirmarDescarte('excecao')) { pessoa.value = pessoaAnterior; return }; pessoaAnterior = pessoa.value; mostrarExcecao() }
  filtro.onchange = mostrarSituacoes
  excecaoForm.oninput = () => sujos.add('excecao')
  atuacaoForm.onsubmit = evento => {
    evento.preventDefault(); if (salvando) return
    const partida = partidas.find(p => p.chave === jogo.value)
    if (!partida) return
    const atletas = Array.from(atuacaoForm.querySelectorAll<HTMLInputElement>('input[name=atleta]:checked')).map(input => input.value)
    if (!atletas.length && !window.confirm('Salvar esta partida sem nenhum atleta marcado? Isso não cria atuações para liberar atletas à colônia.')) return
    const novos = dados()
    novos.atuacoes = [...novos.atuacoes.filter(a => a.partida !== partida.chave), { partida: partida.chave, equipe1: partida.equipe1, equipe2: partida.equipe2, atletas, atualizadaEm: new Date().toISOString() }]
    void salvar(novos, 'atuacao', mostrarAtuacao)
  }
  excecaoForm.onsubmit = evento => {
    evento.preventDefault(); if (salvando || !pessoa.value) return
    const novos = dados()
    const registro: ExcecaoColonia = { atletaId: pessoa.value, motivo: campo('motivo').value as ExcecaoColonia['motivo'], responsavel: campo('responsavel').value.trim(), justificativa: campo('justificativa').value.trim(), ativa: true, atualizadaEm: new Date().toISOString() }
    novos.excecoes = [...novos.excecoes.filter(e => e.atletaId !== pessoa.value), registro]
    void salvar(novos, 'excecao', mostrarExcecao)
  }
  el('#revogar-excecao').onclick = () => {
    if (salvando || !confirmarDescarte('excecao') || !window.confirm('Revogar a exceção salva para este atleta? Sem atuação registrada ele ficará pendente para a colônia.')) return
    const novos = dados(); novos.excecoes = novos.excecoes.map(e => e.atletaId === pessoa.value ? { ...e, ativa: false, atualizadaEm: new Date().toISOString() } : e)
    void salvar(novos, 'excecao', mostrarExcecao)
  }
  function fechar() {
    if (salvando) return
    if (sujos.size && !window.confirm(`Há alterações não salvas em: ${[...sujos].map(s => s === 'atuacao' ? 'participação da partida' : 'exceção').join(' e ')}. Descartar essas alterações e fechar? Os registros já salvos serão mantidos.`)) return
    janela.close()
  }
  el('#fechar-participacoes').onclick = fechar
  janela.addEventListener('cancel', evento => { evento.preventDefault(); fechar() })
  janela.addEventListener('close', () => janela.remove(), { once: true })
  mostrarAtuacao(); mostrarExcecao(); mostrarSituacoes()
  document.body.append(janela); janela.showModal()
}
