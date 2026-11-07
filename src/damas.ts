import { listarCompeticoes, salvarDamas, avancarRegionalDamas } from './banco'
import { exigeAssociado } from './regras-inscricoes'
import {
  damasVazia, copiarDamas, tabelaDamas, resumoConfronto, classificacaoFinalDamas,
  empatesDamas, mesmosIds, classificadosRegional, todosConcluidos, vinculosDamas,
} from './regras-damas'
import type { Damas, Damista, PartidaDamas, ConfrontoDamas, DesempateDamas } from './regras-damas'

type Aba = 'inscricoes' | 'jogos' | 'classificacao'
function no<K extends keyof HTMLElementTagNameMap>(tag: K, texto = '', classe = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); e.textContent = texto; if (classe) e.className = classe; return e
}
function botao(texto: string, acao: () => void, classe = 'botao-secundario'): HTMLButtonElement {
  const b = no('button', texto, classe); b.type = 'button'; b.onclick = acao; return b
}
function select(opcoes: [string, string][], valor = ''): HTMLSelectElement {
  const s = no('select'); for (const [v, t] of opcoes) s.add(new Option(t, v)); s.value = valor; return s
}
function campo(titulo: string, controle: HTMLElement): HTMLLabelElement { const l = no('label', titulo); l.append(controle); return l }
function entrada(valor: string, max: number, obrigatorio = true): HTMLInputElement { const i = no('input'); i.value = valor; i.maxLength = max; i.required = obrigatorio; return i }
function caixa(texto: string, marcado: boolean): { label: HTMLLabelElement; input: HTMLInputElement } {
  const input = no('input'); input.type = 'checkbox'; input.checked = marcado
  const label = no('label', '', 'damas-checkbox'); label.append(input, document.createTextNode(texto)); return { label, input }
}
function lerPartida(f: HTMLFieldSetElement): PartidaDamas {
  const value = (name: string) => (f.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement).value
  if (value('pecasA') === '' || value('pecasB') === '' || value('vencedor') === '') throw new Error('Preencha resultado e peças dos dois jogadores.')
  return { vencedor: value('vencedor') as PartidaDamas['vencedor'], pecasA: Number(value('pecasA')), pecasB: Number(value('pecasB')), brancas: value('brancas') as PartidaDamas['brancas'] }
}
function camposPartida(titulo: string, a: string, b: string, p?: PartidaDamas): HTMLFieldSetElement {
  const f = no('fieldset', '', 'damas-partida'); f.append(no('legend', titulo))
  const resultado = select([['', 'Selecione'], ['a', `Vitória: ${a}`], ['b', `Vitória: ${b}`], ['empate', 'Empate']], p?.vencedor ?? '')
  resultado.name = 'vencedor'; resultado.required = true
  f.append(campo('Resultado', resultado))
  for (const [name, titulo, valor] of [['pecasA', `Peças restantes — ${a}`, p?.pecasA], ['pecasB', `Peças restantes — ${b}`, p?.pecasB]] as const) {
    const i = no('input'); i.name = name; i.type = 'number'; i.min = '0'; i.max = '12'; i.step = '1'; i.required = true; i.value = valor === undefined ? '' : String(valor); f.append(campo(titulo, i))
  }
  const brancas = select([['', 'Não informado'], ['a', a], ['b', b]], p?.brancas ?? ''); brancas.name = 'brancas'
  f.append(campo('Peças brancas (opcional)', brancas)); return f
}

export async function abrirDamas(id: string, etapa: 'regional' | 'final' = 'regional'): Promise<void> {
  const encontrada = (await listarCompeticoes()).find(c => c.id === id && c.modalidade === 'Damas')
  if (!encontrada) throw new Error('Competição de damas não encontrada.')
  if (etapa === 'final' && !encontrada.damas) throw new Error('Conclua a regional e envie os dois primeiros para a final.')
  const regional = etapa === 'regional'
  const chave = regional ? 'damasRegional' : 'damas'
  const tituloEtapa = regional ? 'Regional de damas' : 'Final de damas na colônia'
  let competicao = encontrada
  let dados = copiarDamas(competicao[chave] ?? damasVazia())
  let aba: Aba = 'inscricoes', editando = '', par = '', grupoSelecionado = ''
  let sujo = false, ocupado = false
  const janela = no('dialog', '', 'janela-equipes janela-jogos damas-janela')
  janela.setAttribute('aria-label', 'Damas — inscrições e final')
  const cabecalho = no('div', '', 'titulo-secao')
  const fechar = () => { if (!ocupado && descartar()) janela.close() }
  cabecalho.append(no('h2', tituloEtapa), botao('Fechar', fechar))
  const aviso = no('p', '', 'mensagem'); aviso.setAttribute('role', 'status'); aviso.setAttribute('aria-live', 'polite')
  const nav = no('div', '', 'acoes damas-abas'), conteudo = no('div')
  janela.append(cabecalho, no('p', `${competicao.nome} · ${competicao.categoria} · ${competicao.edicao}`), nav, aviso, conteudo)
  function descartar(): boolean { return !sujo || window.confirm('Há um formulário ainda não salvo. Descartar o preenchimento? Os registros já salvos serão mantidos.') }
  const nome = (id: string) => dados.participantes.find(p => p.id === id)?.nome ?? 'Participante não encontrado'
  const escola = (id: string) => dados.participantes.find(p => p.id === id)?.escola ?? ''
  const erro = (e: unknown) => { aviso.textContent = e instanceof Error ? e.message : 'Não foi possível concluir.' }
  function formulario(): HTMLFormElement { const f = no('form'); f.addEventListener('input', () => { sujo = true }); f.addEventListener('change', () => { sujo = true }); return f }
  function submit(f: HTMLFormElement, texto: string) { const b = no('button', texto, 'botao'); b.type = 'submit'; f.append(b) }
  function mudouResultados(novo: Damas): boolean {
    if (novo.desempates.length && !window.confirm('Alterar resultados regulares invalida os desempates da classificação. Será necessário registrá-los novamente. Continuar?')) return false
    novo.desempates = []; return true
  }
  async function salvar(novo: Damas, mensagem: string): Promise<boolean> {
    if (ocupado) return false
    ocupado = true
    janela.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('button,input,select,textarea').forEach(e => { e.disabled = true })
    try {
      competicao = await salvarDamas(id, novo, competicao[chave], etapa)
      dados = copiarDamas(competicao[chave]!); sujo = false; aviso.textContent = mensagem; renderizar(); return true
    } catch (e) { erro(e); return false }
    finally { ocupado = false; renderizarTravas() }
  }
  function renderizarTravas() {
    janela.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('button,input,select,textarea').forEach(e => { e.disabled = e.dataset.bloqueado === 'sim' })
  }
  function bloquear(e: HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) { e.disabled = true; e.dataset.bloqueado = 'sim' }
  function renderizar() {
    nav.replaceChildren()
    for (const [chave, titulo] of [['inscricoes', '1. Inscrições'], ['jogos', '2. Confrontos'], ['classificacao', '3. Classificação']] as const) {
      const b = botao(titulo, () => { if (descartar()) { aba = chave; sujo = false; editando = ''; aviso.textContent = ''; renderizar() } }, aba === chave ? 'botao' : 'botao-secundario')
      b.setAttribute('aria-pressed', String(aba === chave)); nav.append(b)
    }
    conteudo.replaceChildren()
    if (regional && competicao.damasFinalDaRegional) conteudo.append(no('p', 'Dois classificados enviados à final. Regional preservada e bloqueada.'))
    if (dados.encerrada) conteudo.append(no('p', 'Competição encerrada. Reabra na aba Classificação para fazer correções.', 'damas-status'))
    if (aba === 'inscricoes') inscricoes()
    else if (aba === 'jogos') jogos()
    else classificacao()
  }
  function inscricoes() {
    conteudo.append(no('p', regional ? 'Cadastre os participantes da regional. Os dois primeiros avançam para a colônia após o encerramento.' : 'Participantes da final. Na competição completa, as vagas vêm automaticamente da regional.', 'ajuda'))
    const p = dados.participantes.find(p => p.id === editando)
    const f = formulario(); f.className = 'damas-form'
    const campos = {
      nome: entrada(p?.nome ?? '', 120), escola: entrada(p?.escola ?? '', 40), ano: entrada(p ? String(p.anoNascimento) : '', 4),
      tipo: select([['NIF', 'NIF'], ['RG', 'RG'], ['CPF', 'CPF']], p?.tipoDocumento ?? 'RG'), documento: entrada(p?.documento ?? '', 40),
      vinculo: select(vinculosDamas.map(v => [v, v]), p?.vinculo ?? 'Sócio/funcionário'), associado: entrada(p?.associadoNome ?? '', 120, false), identificacao: entrada(p?.associadoIdentificacao ?? '', 40, false),
    }
    campos.ano.type = 'number'; campos.ano.min = '1900'; campos.ano.max = /^\d{4}$/.test(competicao.edicao) ? competicao.edicao : String(new Date().getFullYear()); campos.ano.step = '1'
    campos.nome.name = 'nome'; campos.escola.name = 'escola'; campos.ano.name = 'anoNascimento'; campos.documento.name = 'documento'; campos.vinculo.name = 'vinculo'
    for (const [t, e] of [['Nome', campos.nome], ['Escola / unidade / CFP', campos.escola], ['Ano de nascimento', campos.ano], ['Tipo de documento', campos.tipo], ['Documento', campos.documento], ['Vínculo', campos.vinculo], ['Nome do associado relacionado', campos.associado], ['Identificação do associado relacionado', campos.identificacao]] as const) f.append(campo(t, e))
    const familiar = () => { campos.associado.required = exigeAssociado(campos.vinculo.value); campos.identificacao.required = campos.associado.required }
    familiar(); campos.vinculo.addEventListener('change', familiar)
    const classificado = caixa('Classificação para a colônia conferida com a organização', p?.classificado ?? false)
    classificado.input.name = 'classificado'; if (!regional) f.append(classificado.label)
    const agendado = !!p && dados.ordem.includes(p.id)
    if (agendado) bloquear(classificado.input)
    submit(f, p ? 'Salvar alterações do participante' : 'Salvar participante')
    f.append(botao('Limpar / cancelar edição', () => { editando = ''; sujo = false; renderizar() }))
    f.onsubmit = async e => {
      e.preventDefault()
      const novo = copiarDamas(dados)
      const participante: Damista = {
        id: p?.id ?? crypto.randomUUID(), nome: campos.nome.value.trim(), escola: campos.escola.value.trim(), anoNascimento: Number(campos.ano.value), tipoDocumento: campos.tipo.value as Damista['tipoDocumento'], documento: campos.documento.value.trim(), vinculo: campos.vinculo.value as Damista['vinculo'], associadoNome: campos.associado.value.trim(), associadoIdentificacao: campos.identificacao.value.trim(), ativo: p?.ativo ?? true, classificado: regional ? false : classificado.input.checked,
      }
      novo.participantes = novo.participantes.filter(a => a.id !== participante.id); novo.participantes.push(participante)
      const antigo = editando; editando = ''
      if (!await salvar(novo, 'Participante salvo. Você já pode fechar esta janela.')) editando = antigo
    }
    if (!dados.encerrada && !(competicao.damasFinalDaRegional && !regional)) conteudo.append(no('h3', p ? 'Editar participante' : 'Inscrever participante'), f)
    const ativos = dados.participantes.filter(p => p.ativo)
    conteudo.append(no('h3', `Inscritos: ${ativos.length} ativos · ${(regional ? classificadosRegional(competicao).length : ativos.filter(p => p.classificado).length)} classificados para a colônia`))
    for (const atleta of dados.participantes) {
      const card = no('article', '', 'partida')
      card.append(no('h4', `${atleta.nome} — ${atleta.escola}`), no('p', `${atleta.vinculo} · ${atleta.ativo ? 'Ativo' : 'Cancelado'} · ${(regional ? classificadosRegional(competicao).includes(atleta.id) : atleta.classificado) ? 'Classificado para a colônia' : 'Inscrito na regional'}`))
      const editar = botao('Editar', () => { if (descartar()) { editando = atleta.id; sujo = false; renderizar(); conteudo.querySelector('input')?.focus() } })
      const cancelar = botao(atleta.ativo ? 'Cancelar inscrição' : 'Reativar', async () => {
        if (!descartar() || !window.confirm(`${atleta.ativo ? 'Cancelar' : 'Reativar'} a inscrição de ${atleta.nome}?`)) return
        const novo = copiarDamas(dados); novo.participantes = novo.participantes.map(p => p.id === atleta.id ? { ...p, ativo: !p.ativo } : p)
        editando = ''; await salvar(novo, 'Inscrição atualizada.')
      })
      if (dados.encerrada || (competicao.damasFinalDaRegional && !regional)) bloquear(editar)
      if (dados.encerrada || dados.ordem.includes(atleta.id)) bloquear(cancelar)
      card.append(editar, cancelar)
      if (dados.ordem.includes(atleta.id)) card.append(no('p', 'Participante incluído na tabela. Cancelamento bloqueado para preservar os confrontos.', 'ajuda'))
      conteudo.append(card)
    }
  }
  function jogos() {
    const tabela = tabelaDamas(dados.ordem)
    conteudo.append(no('p', 'Três partidas obrigatórias por confronto. Peças restantes de 0 a 12, contando cada dama como uma peça. O resultado da partida é informado pelo organizador; não é deduzido do número de peças.', 'ajuda'))
    if (!tabela.length) {
      const elegiveis = dados.participantes.filter(p => p.ativo && (regional || p.classificado))
      conteudo.append(no('p', `${elegiveis.length} participantes elegíveis para esta etapa. Os resultados começam zerados.`))
      const gerar = botao('Gerar todos contra todos', async () => {
        if (elegiveis.length < 2) { aviso.textContent = 'Cadastre ao menos dois participantes elegíveis.'; return }
        if (!window.confirm(`Gerar ${elegiveis.length * (elegiveis.length - 1) / 2} confrontos, com três partidas cada, para os ${elegiveis.length} participantes?`)) return
        const novo = copiarDamas(dados); novo.ordem = elegiveis.map(p => p.id); await salvar(novo, 'Tabela gerada. Todos jogam uma vez contra cada adversário.')
      }, 'botao'); if (dados.encerrada) bloquear(gerar); conteudo.append(gerar); return
    }
    const completos = dados.resultados.filter(r => resumoConfronto(r).vencedor).length
    conteudo.append(no('p', `${completos} de ${tabela.length} confrontos concluídos · ${dados.ordem.length} participantes`))
    const acoes = no('div', '', 'acoes')
    acoes.append(botao('Imprimir tabela e resultados', () => imprimir(false)))
    if (!dados.resultados.some(r => r.partidas.length || r.extras.length) && !dados.encerrada && !(competicao.damasFinalDaRegional && !regional)) acoes.append(botao('Desfazer tabela sem resultados', async () => {
      if (!descartar() || !window.confirm('Desfazer a tabela? As inscrições serão mantidas.')) return
      const novo = copiarDamas(dados); novo.ordem = []; novo.resultados = []; novo.desempates = []; par = ''; await salvar(novo, 'Tabela desfeita. Ajuste os inscritos e gere novamente.')
    }))
    conteudo.append(acoes)
    const chave = (j: { a: string; b: string }) => JSON.stringify([j.a, j.b])
    if (!tabela.some(j => chave(j) === par)) par = chave(tabela[0]!)
    const escolha = select(tabela.map(j => [chave(j), `Rodada ${j.rodada} · ${nome(j.a)} × ${nome(j.b)}`]), par)
    escolha.onchange = () => { if (!descartar()) { escolha.value = par; return }; par = escolha.value; sujo = false; renderizar() }
    conteudo.append(campo('Confronto', escolha))
    const confronto = tabela.find(j => chave(j) === par)!
    const r = dados.resultados.find(r => r.a === confronto.a && r.b === confronto.b) ?? { a: confronto.a, b: confronto.b, partidas: [], extras: [] }
    const resumo = resumoConfronto(r)
    conteudo.append(no('h3', `${nome(r.a)} × ${nome(r.b)}`), no('p', `Escolas: ${escola(r.a)} × ${escola(r.b)}`))
    conteudo.append(no('p', `Vitórias nas partidas: ${resumo.vitoriasA} × ${resumo.vitoriasB} · Peças: ${resumo.pecasA} × ${resumo.pecasB}`))
    conteudo.append(no('p', resumo.vencedor ? `Vencedor: ${nome(resumo.vencedor === 'a' ? r.a : r.b)} — ${resumo.motivo}` : resumo.motivo, 'damas-status'))
    const salvarResultado = async (atualizado: ConfrontoDamas) => {
      const novo = copiarDamas(dados); if (!mudouResultados(novo)) return
      novo.resultados = novo.resultados.filter(x => x.a !== r.a || x.b !== r.b); novo.resultados.push(atualizado)
      await salvar(novo, 'Resultado salvo. Classificação recalculada.')
    }
    // Uma edição por vez, evitando perder o rascunho de outra partida.
    const lista = no('div')
    r.partidas.forEach((p, i) => {
      const linha = no('p', `Partida ${i + 1}: ${textoPartida(p, r.a, r.b)} `)
      if (!dados.encerrada) linha.append(botao('Corrigir', () => { if (descartar()) { sujo = false; editor(i, p) } }))
      lista.append(linha)
    })
    conteudo.append(lista)
    const areaEditor = no('div'); conteudo.append(areaEditor)
    function editor(indice: number, p?: PartidaDamas) {
      areaEditor.replaceChildren()
      const form = formulario(), campos = camposPartida(`Partida ${indice + 1} de 3`, nome(r.a), nome(r.b), p)
      form.append(campos); submit(form, 'Salvar partida')
      if (p) form.append(botao('Cancelar correção', () => { sujo = false; renderizar() }))
      form.onsubmit = async e => {
        e.preventDefault()
        try {
          const partida = lerPartida(campos)
          if (r.extras.length && !window.confirm('A correção das partidas regulares removerá os jogos extras deste confronto. Continuar?')) return
          const partidas = r.partidas.map(p => ({ ...p })); partidas[indice] = partida
          await salvarResultado({ ...r, partidas, extras: [] })
        } catch (e) { erro(e) }
      }
      areaEditor.append(form)
    }
    if (!dados.encerrada && r.partidas.length < 3) editor(r.partidas.length)
    r.extras.forEach((p, i) => conteudo.append(no('p', `Extra ${i + 1}: ${textoPartida(p, r.a, r.b)}`)))
    if (!dados.encerrada && r.extras.length) conteudo.append(botao('Remover último extra para corrigir', async () => {
      if (descartar() && window.confirm('Remover o último jogo extra? Será necessário registrá-lo novamente.')) await salvarResultado({ ...r, extras: r.extras.slice(0, -1) })
    }))
    if (!dados.encerrada && r.partidas.length === 3 && !resumo.vencedor) {
      const f = formulario(), campos = camposPartida(`Jogo extra ${r.extras.length + 1}`, nome(r.a), nome(r.b))
      f.append(no('p', 'O extra decide o confronto; suas peças não entram no total regular. Se empatar, registre o empate e continue com outro extra.', 'ajuda'), campos); submit(f, 'Salvar jogo extra')
      f.onsubmit = async e => { e.preventDefault(); try { await salvarResultado({ ...r, extras: [...r.extras, lerPartida(campos)] }) } catch (e) { erro(e) } }; conteudo.append(f)
    }
  }
  function textoPartida(p: PartidaDamas, a: string, b: string): string {
    return `${p.vencedor === 'empate' ? 'Empate' : `Vitória de ${nome(p.vencedor === 'a' ? a : b)}`} · peças ${p.pecasA} × ${p.pecasB}${p.brancas ? ` · brancas: ${nome(p.brancas === 'a' ? a : b)}` : ''}`
  }
  function tabelaClassificacao(): HTMLTableElement {
    const table = no('table', '', 'damas-tabela'), thead = no('thead'), tr = no('tr')
    for (const t of ['Posição', 'Participante', 'Escola', 'Confrontos concluídos', 'Vitórias em confrontos', 'Peças regulares']) tr.append(no('th', t))
    thead.append(tr); table.append(thead)
    const tbody = no('tbody'), linhas = classificacaoFinalDamas(dados), empatados = empatesDamas(dados)
    linhas.forEach((l, i) => {
      const grupo = empatados.find(g => g.includes(l.id))
      const pendente = grupo && !dados.desempates.some(t => mesmosIds(t.participantes, grupo))
      const posicao = pendente ? `${linhas.findIndex(x => grupo.includes(x.id)) + 1} (empatado)` : String(i + 1)
      const row = no('tr'); for (const v of [posicao, nome(l.id), escola(l.id), String(l.confrontos), String(l.vitorias), String(l.pecas)]) row.append(no('td', v)); tbody.append(row)
    }); table.append(tbody); return table
  }
  function classificacao() {
    if (!dados.ordem.length) { conteudo.append(no('p', 'Gere a tabela na aba Confrontos para acompanhar a classificação.')); return }
    const completo = todosConcluidos(dados), empates = empatesDamas(dados)
    conteudo.append(no('h3', dados.encerrada ? 'Classificação final' : 'Classificação provisória'), no('p', 'Ordem: vitórias em confrontos, depois soma das peças das partidas regulares já salvas. Jogos extras não somam peças nem novas vitórias na classificação. Empates ainda não resolvidos aparecem na mesma posição.', 'ajuda'))
    const scroll = no('div', '', 'damas-scroll'); scroll.append(tabelaClassificacao()); conteudo.append(scroll)
    conteudo.append(botao('Imprimir classificação', () => imprimir(true)))
    if (!completo) conteudo.append(no('p', 'Conclua todos os confrontos antes de resolver os empates da classificação ou encerrar.'))
    if (completo && empates.length) {
      conteudo.append(no('h3', 'Desempates da classificação'))
      if (!empates.some(g => JSON.stringify(g) === grupoSelecionado)) grupoSelecionado = JSON.stringify(empates[0])
      const escolha = select(empates.map(g => [JSON.stringify(g), g.map(nome).join(' × ')]), grupoSelecionado)
      escolha.onchange = () => { if (!descartar()) { escolha.value = grupoSelecionado; return }; grupoSelecionado = escolha.value; sujo = false; renderizar() }; conteudo.append(campo('Grupo empatado', escolha))
      const grupo = empates.find(g => JSON.stringify(g) === grupoSelecionado)!
      const salvo = dados.desempates.find(t => mesmosIds(grupo, t.participantes))
      if (salvo) { conteudo.append(no('p', `Ordem registrada: ${salvo.ordem.map(nome).join(' → ')}. Responsável: ${salvo.responsavel}`)); for (const j of salvo.jogos) conteudo.append(no('p', `${nome(j.a)} × ${nome(j.b)}: ${textoPartida(j.partida, j.a, j.b)}`)) }
      if (!dados.encerrada) editorDesempate(grupo, salvo)
    }
    const pronto = completo && empates.every(g => dados.desempates.some(t => mesmosIds(t.participantes, g)))
    const encerrar = botao(dados.encerrada ? 'Reabrir para correção' : 'Encerrar competição', async () => {
      if (!descartar() || !window.confirm(dados.encerrada ? 'Reabrir a competição para correções?' : 'Conferiu os resultados e a classificação? Encerrar a competição?')) return
      const novo = copiarDamas(dados); novo.encerrada = !dados.encerrada; await salvar(novo, novo.encerrada ? 'Competição encerrada. Exporte um backup atualizado na tela inicial.' : 'Competição reaberta para correções.')
    }, 'botao')
    if (!pronto && !dados.encerrada) bloquear(encerrar)
    if (regional && competicao.damasFinalDaRegional) bloquear(encerrar)
    conteudo.append(no('hr'), encerrar)
    if (regional && dados.encerrada) {
      const ids = classificadosRegional(competicao)
      conteudo.append(no('h3', 'Classificados para a colônia'), no('p', ids.map(nome).join(' e ')))
      if (!competicao.damas) conteudo.append(botao('Enviar os dois classificados para a final', async () => {
        if (ocupado || !window.confirm('Abrir a final com os dois primeiros e resultados zerados? A regional ficará bloqueada para preservar as vagas.')) return
        ocupado = true
        try { competicao = await avancarRegionalDamas(id, competicao.damasRegional!); aviso.textContent = 'Final criada. Use Abrir final na colônia.'; renderizar() }
        catch (e) { erro(e) } finally { ocupado = false }
      }, 'botao'))
      else if (!competicao.damasFinalDaRegional) conteudo.append(no('p', 'Esta competição já possuía uma final da versão anterior. Ela foi preservada. Use uma nova competição para testar regional e final integradas.'))
      if (competicao.damas) conteudo.append(botao('Abrir final na colônia', async () => { janela.close(); await abrirDamas(id, 'final') }))
    }
  }
  function editorDesempate(grupo: string[], salvo?: DesempateDamas) {
    const f = formulario(); f.append(no('p', grupo.length === 2 ? 'Registre o jogo extra. Um empate permite outra partida; o vencedor fica à frente.' : 'Há três ou mais empatados. Registre os jogos extras e a ordem confirmada pela organização, descrevendo o formato adotado. O sistema não escolhe esse formato automaticamente.', 'ajuda'))
    const jogosArea = no('div'); f.append(jogosArea)
    const linhas: { bloco: HTMLElement; a: HTMLSelectElement; b: HTMLSelectElement; campos: HTMLFieldSetElement }[] = []
    function adicionar(j?: DesempateDamas['jogos'][number]) {
      const bloco = no('div', '', 'damas-extra'), a = select(grupo.map(id => [id, nome(id)]), j?.a ?? grupo[0]), b = select(grupo.map(id => [id, nome(id)]), j?.b ?? grupo[1])
      const campos = camposPartida('Jogo extra da classificação', 'Jogador A selecionado', 'Jogador B selecionado', j?.partida)
      const linha = { bloco, a, b, campos }; linhas.push(linha)
      bloco.append(campo('Jogador A', a), campo('Jogador B', b), campos, botao('Remover esta linha', () => { linhas.splice(linhas.indexOf(linha), 1); bloco.remove(); sujo = true }))
      jogosArea.append(bloco)
    }
    if (salvo) salvo.jogos.forEach(adicionar); else adicionar()
    f.append(botao('Acrescentar jogo extra', () => { adicionar(); sujo = true }))
    const ordens: HTMLSelectElement[] = []
    if (grupo.length > 2) grupo.forEach((_, i) => { const s = select([['', 'Selecione'], ...grupo.map(id => [id, nome(id)] as [string, string])], salvo?.ordem[i] ?? ''); s.required = true; ordens.push(s); f.append(campo(`${i + 1}º entre os empatados`, s)) })
    const responsavel = entrada(salvo?.responsavel ?? '', 120)
    const observacao = no('textarea'); observacao.maxLength = 1000; observacao.value = salvo?.observacao ?? ''; observacao.required = grupo.length > 2
    f.append(campo('Responsável pela decisão', responsavel), campo('Observação / formato adotado', observacao)); submit(f, 'Salvar desempate da classificação')
    f.onsubmit = async e => {
      e.preventDefault()
      try {
        const jogos = linhas.map(l => ({ a: l.a.value, b: l.b.value, partida: lerPartida(l.campos) }))
        let ordem = ordens.map(s => s.value)
        if (grupo.length === 2) { const decisiva = jogos.find(j => j.partida.vencedor !== 'empate'); if (!decisiva) throw new Error('Registre uma partida extra decisiva antes de salvar a ordem.'); const vencedor = decisiva.partida.vencedor === 'a' ? decisiva.a : decisiva.b; ordem = [vencedor, ...grupo.filter(id => id !== vencedor)] }
        const novo = copiarDamas(dados); novo.desempates = novo.desempates.filter(t => !mesmosIds(t.participantes, grupo))
        novo.desempates.push({ participantes: [...grupo], jogos, ordem, responsavel: responsavel.value.trim(), observacao: observacao.value.trim() })
        await salvar(novo, 'Desempate salvo. Confira a classificação atualizada.')
      } catch (e) { erro(e) }
    }
    conteudo.append(f)
  }
  function imprimir(apenasClassificacao: boolean) {
    const folha = no('section', '', 'damas-impressao')
    folha.append(no('h1', `${competicao.nome} — ${tituloEtapa}`), no('p', `${competicao.categoria} · ${competicao.edicao} · ${competicao.local}`), no('h2', dados.encerrada ? 'Classificação final' : 'Classificação provisória'), tabelaClassificacao(), no('p', 'Critérios: confrontos vencidos; peças restantes nas partidas regulares; jogos extras de desempate.'))
    if (!apenasClassificacao) {
      for (const j of tabelaDamas(dados.ordem)) {
        const ficha = no('article', '', 'damas-ficha'), r = dados.resultados.find(r => r.a === j.a && r.b === j.b)
        ficha.append(no('h3', `Rodada ${j.rodada}: ${nome(j.a)} (${escola(j.a)}) × ${nome(j.b)} (${escola(j.b)})`))
        for (let i = 0; i < 3; i++) ficha.append(no('p', `Partida ${i + 1}: ${r?.partidas[i] ? textoPartida(r.partidas[i]!, j.a, j.b) : 'Resultado: __________________  Peças A: ____  Peças B: ____  Brancas: ____'}`))
        for (const [i, p] of (r?.extras ?? []).entries()) ficha.append(no('p', `Extra ${i + 1}: ${textoPartida(p, j.a, j.b)}`))
        const vencedor = r ? resumoConfronto(r).vencedor : null
        ficha.append(no('p', `Vencedor do confronto: ${vencedor ? nome(vencedor === 'a' ? j.a : j.b) : '________________________'}`)); folha.append(ficha)
      }
    }
    for (const t of dados.desempates) {
      folha.append(no('h3', 'Desempate da classificação'), no('p', `Ordem: ${t.ordem.map(nome).join(' → ')}. Responsável: ${t.responsavel}. ${t.observacao}`))
      for (const j of t.jogos) folha.append(no('p', `${nome(j.a)} × ${nome(j.b)}: ${textoPartida(j.partida, j.a, j.b)}`))
    }
    folha.append(no('p', `Emitido em ${new Date().toLocaleString('pt-BR')}. Os formulários ainda não salvos não estão incluídos.`))
    document.body.append(folha); document.body.classList.add('damas-imprimindo')
    try { window.print() } finally { document.body.classList.remove('damas-imprimindo'); folha.remove() }
  }
  janela.addEventListener('cancel', e => { e.preventDefault(); fechar() })
  janela.addEventListener('close', () => { window.removeEventListener('beforeunload', sair); janela.remove() }, { once: true })
  function sair(e: BeforeUnloadEvent) { if (sujo || ocupado) { e.preventDefault(); e.returnValue = '' } }
  window.addEventListener('beforeunload', sair)
  renderizar(); document.body.append(janela); janela.showModal()
}
