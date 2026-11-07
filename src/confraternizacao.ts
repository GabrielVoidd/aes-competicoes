import { atletasDamas } from './regras-damas'
import { listarCompeticoes, salvarConfraternizacao } from './banco'
import { categoriasFesta, faixasFesta, festaVazia, copiarConfraternizacao, valorPessoa, direitoHospedagem } from './regras-confraternizacao'
import type { EtapaFesta, PessoaFesta } from './regras-confraternizacao'

export async function abrirConfraternizacao(id: string): Promise<void> {
  const encontrada = (await listarCompeticoes()).find(c => c.id === id)
  if (!encontrada) throw new Error('Competição não encontrada.')
  let c = encontrada
  const atletasFesta = () => c.modalidade === 'Damas'
    ? atletasDamas(c).map(p => ({ ...p, unidade: p.escola }))
    : (c.inscricoes?.atletas ?? []).map(p => ({ ...p, unidade: c.equipes?.find(e => e.id === p.equipeId)?.unidade ?? '' }))
  let etapa: EtapaFesta = 'regional', editando = '', ocupado = false
  const pendentes = new Set<string>()
  const janela = document.createElement('dialog')
  janela.className = 'janela-equipes janela-jogos festa-janela'
  janela.setAttribute('aria-label', 'Confraternização e hospedagem')
  janela.innerHTML = `
    <div class="titulo-secao"><h2>Confraternização e hospedagem</h2><button type="button" id="f-fechar" class="botao-secundario">Fechar</button></div>
    <p id="f-titulo"></p>
    <label>Etapa <select id="f-etapa"><option value="regional">Regional</option><option value="final">Final na colônia — churrasco</option></select></label>
    <p class="ajuda">Escola obrigatória, inclusive para quem não disputa os jogos. Cada etapa tem inscrições e preços próprios. Cadastrar um convidado aqui não o inscreve como atleta.</p>
    <p id="f-msg" role="status" aria-live="polite"></p>
    <details><summary>Configurar preços desta etapa</summary><form id="f-precos"><p>Valores em reais. Vazio = preço ainda não definido; 0 = gratuito. Alterações recalculam os totais de todos os inscritos desta etapa.</p><div id="f-valores"></div><button class="botao" type="submit">Salvar preços</button></form></details>
    <h3 id="f-form-titulo">Inscrever pessoa</h3>
    <form id="f-pessoa" class="festa-form">
      <label>Categoria<select name="categoria" required></select></label>
      <label id="f-atleta-label" hidden>Atleta cadastrado<select name="atletaId"><option value="">Selecione</option></select></label>
      <label>Nome<input name="nome" maxlength="120" required></label>
      <label>Documento (RG, CPF ou identificação)<input name="documento" maxlength="50" required></label>
      <label>Escola / unidade / CFP<input name="escola" list="f-escolas" maxlength="40" required placeholder="Ex.: 1.28"></label><datalist id="f-escolas"></datalist>
      <label>Faixa etária<select name="faixa" required></select></label>
      <p class="ajuda">Selecione a faixa aplicável ao evento. Ela não é calculada pela regra de ano de nascimento do Futsal Master. Confira os limites e preços com a organização.</p>
      <div><button class="botao" type="submit">Salvar inscrição</button> <button id="f-limpar" class="botao-secundario" type="button">Limpar / cancelar edição</button></div>
    </form>
    <h3>Inscrições salvas</h3><label>Filtrar por escola<select id="f-filtro"><option value="">Todas</option></select></label>
    <div id="f-resumo"></div><div id="f-lista"></div>
    <p class="ajuda">Na final, somente atletas classificados e aptos têm direito à hospedagem. Esta consulta não reserva nem distribui quartos. Damas utiliza os dois primeiros da regional encerrada. As modalidades ainda não implementadas não liberam hospedagem automaticamente.</p>`
  const el = <T extends Element>(s: string) => janela.querySelector<T>(s)!
  const form = el<HTMLFormElement>('#f-pessoa'), precos = el<HTMLFormElement>('#f-precos')
  const campo = (s: string) => form.elements.namedItem(s) as HTMLInputElement | HTMLSelectElement
  const mensagem = (s: string) => { el('#f-msg').textContent = s }
  const dinheiro = (v: number) => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  el('#f-titulo').textContent = `${c.nome} · ${c.categoria}`
  function opcao(select: HTMLSelectElement, valor: string, texto: string) { select.add(new Option(texto, valor)) }
  for (const categoria of categoriasFesta) opcao(campo('categoria') as HTMLSelectElement, categoria, categoria)
  campo('categoria').value = 'Sócio'
  for (const faixa of faixasFesta) opcao(campo('faixa') as HTMLSelectElement, faixa, faixa)
  for (const a of atletasFesta()) opcao(campo('atletaId') as HTMLSelectElement, a.id, `${a.nome}${a.ativo ? '' : ' (cancelado)'}`)
  const unidades = new Set([...(c.equipes ?? []).map(e => e.unidade), ...atletasFesta().map(a => a.unidade)])
  for (const etapa of ['regional', 'final'] as const) for (const p of c.confraternizacao?.[etapa].pessoas ?? []) unidades.add(p.escola)
  for (const u of unidades) { const o = document.createElement('option'); o.value = u; el('#f-escolas').append(o) }
  for (const categoria of categoriasFesta) for (const faixa of faixasFesta) {
    const label = document.createElement('label'); label.textContent = `${categoria} · ${faixa}`
    const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = '1000000'; input.step = '0.01'; input.placeholder = 'Não definido'; input.name = `preco${precos.querySelectorAll('input').length}`
    label.append(input); el('#f-valores').append(label)
  }
  function categoriaMudou() {
    const atleta = campo('categoria').value === 'Atleta'
    el<HTMLElement>('#f-atleta-label').hidden = !atleta
    campo('atletaId').required = atleta
    if (!atleta) campo('atletaId').value = ''
  }
  campo('categoria').addEventListener('change', categoriaMudou)
  campo('atletaId').addEventListener('change', () => {
    const a = atletasFesta().find(a => a.id === campo('atletaId').value)
    if (!a) return
    campo('nome').value = a.nome; campo('documento').value = a.documento
    campo('escola').value = a.unidade
  })
  form.addEventListener('input', () => pendentes.add('pessoa'))
  form.addEventListener('change', () => pendentes.add('pessoa'))
  precos.addEventListener('input', () => pendentes.add('precos'))
  const podeDescartar = () => pendentes.size === 0 || window.confirm('Há alterações ainda não salvas. Descartá-las? Os registros já salvos serão mantidos.')
  function limpar() { form.reset(); campo('categoria').value = 'Sócio'; editando = ''; categoriaMudou(); pendentes.delete('pessoa'); el('#f-form-titulo').textContent = 'Inscrever pessoa' }
  el('#f-limpar').addEventListener('click', limpar)
  function carregarPrecos() { const f = c.confraternizacao?.[etapa] ?? festaVazia()[etapa]; precos.querySelectorAll<HTMLInputElement>('input').forEach((input, i) => { const valor = f.precos[i]; input.value = valor == null ? '' : String(valor / 100) }) }
  function renderizar() {
    const f = c.confraternizacao?.[etapa] ?? festaVazia()[etapa]
    const filtro = el<HTMLSelectElement>('#f-filtro'), escolhido = filtro.value
    filtro.replaceChildren(new Option('Todas', ''))
    for (const u of [...new Set(f.pessoas.map(p => p.escola))].sort()) opcao(filtro, u, u)
    filtro.value = [...filtro.options].some(o => o.value === escolhido) ? escolhido : ''
    const pessoas = f.pessoas.filter(p => !filtro.value || p.escola === filtro.value)
    const resumo = el('#f-resumo'); resumo.replaceChildren()
    const ativas = pessoas.filter(p => p.ativo)
    for (const u of [...new Set(ativas.map(p => p.escola))].sort()) {
      const lista = ativas.filter(p => p.escola === u), semPreco = lista.filter(p => valorPessoa(f, p) === null).length
      const linha = document.createElement('p'); linha.textContent = `${u}: ${lista.length} pessoa(s) · subtotal ${dinheiro(lista.reduce((t, p) => t + (valorPessoa(f, p) ?? 0), 0))}${semPreco ? ` · ${semPreco} sem preço definido` : ''}`; resumo.append(linha)
    }
    const total = document.createElement('p'); total.textContent = `Total da seleção: ${ativas.length} pessoa(s) · ${dinheiro(ativas.reduce((t, p) => t + (valorPessoa(f, p) ?? 0), 0))}${ativas.some(p => valorPessoa(f, p) === null) ? ' (parcial: há preços pendentes)' : ''}`; resumo.append(total)
    const lista = el('#f-lista'); lista.replaceChildren()
    if (!pessoas.length) lista.textContent = 'Nenhuma inscrição nesta seleção.'
    for (const p of pessoas) {
      const card = document.createElement('article'); card.className = 'partida'
      const titulo = document.createElement('h4'); titulo.textContent = `${p.nome} — ${p.escola}${p.ativo ? '' : ' (cancelado)'}`
      const detalhe = document.createElement('p'); const valor = valorPessoa(f, p); detalhe.textContent = `${p.categoria} · ${p.faixa} · ${valor === null ? 'Preço não definido' : dinheiro(valor)}`
      card.append(titulo, detalhe)
      if (etapa === 'final') { const h = document.createElement('p'); h.textContent = direitoHospedagem(c, p); card.append(h) }
      const editar = document.createElement('button'); editar.type = 'button'; editar.className = 'botao-secundario'; editar.textContent = 'Editar'
      editar.onclick = () => { if (pendentes.has('pessoa') && !window.confirm('Descartar o preenchimento ainda não salvo?')) return; limpar(); editando = p.id; for (const k of ['nome', 'documento', 'escola', 'categoria', 'faixa', 'atletaId'] as const) campo(k).value = p[k]; categoriaMudou(); el('#f-form-titulo').textContent = 'Editar inscrição'; campo('nome').focus() }
      const cancelar = document.createElement('button'); cancelar.type = 'button'; cancelar.className = 'botao-secundario'; cancelar.textContent = p.ativo ? 'Cancelar inscrição' : 'Reativar'
      cancelar.onclick = async () => { if (!window.confirm(`${p.ativo ? 'Cancelar' : 'Reativar'} a inscrição de ${p.nome}?`)) return; const dados = copiarConfraternizacao(c.confraternizacao ?? festaVazia()); dados[etapa].pessoas = dados[etapa].pessoas.map(x => x.id === p.id ? { ...x, ativo: !x.ativo } : x); await salvar(dados, '') }
      card.append(editar, cancelar); lista.append(card)
    }
  }
  async function salvar(dados: ReturnType<typeof festaVazia>, tipo: string) {
    if (ocupado) return
    ocupado = true
    janela.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button,input,select').forEach(e => { e.disabled = true })
    try { c = await salvarConfraternizacao(id, dados, c); pendentes.delete(tipo); if (tipo === 'pessoa') limpar(); mensagem(`Salvo. ${pendentes.size ? 'Ainda há alterações não salvas em outro formulário.' : 'Você já pode fechar esta janela.'}`); renderizar() }
    catch (e) { mensagem(e instanceof Error ? e.message : 'Não foi possível salvar.') }
    finally { ocupado = false; janela.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button,input,select').forEach(e => { e.disabled = false }) }
  }
  form.addEventListener('submit', async e => {
    e.preventDefault()
    const dados = copiarConfraternizacao(c.confraternizacao ?? festaVazia())
    const anterior = dados[etapa].pessoas.find(p => p.id === editando)
    const pessoa: PessoaFesta = { id: editando || crypto.randomUUID(), nome: campo('nome').value.trim(), documento: campo('documento').value.trim(), escola: campo('escola').value.trim(), categoria: campo('categoria').value as PessoaFesta['categoria'], faixa: campo('faixa').value as PessoaFesta['faixa'], atletaId: campo('atletaId').value, ativo: anterior?.ativo ?? true }
    dados[etapa].pessoas = dados[etapa].pessoas.filter(p => p.id !== pessoa.id); dados[etapa].pessoas.push(pessoa)
    await salvar(dados, 'pessoa')
  })
  precos.addEventListener('submit', async e => { e.preventDefault(); const dados = copiarConfraternizacao(c.confraternizacao ?? festaVazia()); dados[etapa].precos = [...precos.querySelectorAll<HTMLInputElement>('input')].map(i => i.value === '' ? null : Math.round(Number(i.value) * 100)); await salvar(dados, 'precos') })
  el('#f-filtro').addEventListener('change', renderizar)
  el<HTMLSelectElement>('#f-etapa').addEventListener('change', () => { const select = el<HTMLSelectElement>('#f-etapa'); if (!podeDescartar()) { select.value = etapa; return }; etapa = select.value as EtapaFesta; pendentes.clear(); limpar(); carregarPrecos(); mensagem(''); renderizar() })
  const fechar = () => { if (!ocupado && podeDescartar()) janela.close() }
  el('#f-fechar').addEventListener('click', fechar)
  janela.addEventListener('cancel', e => { e.preventDefault(); fechar() })
  janela.addEventListener('close', () => janela.remove(), { once: true })
  categoriaMudou(); carregarPrecos(); renderizar(); document.body.append(janela); janela.showModal()
}
