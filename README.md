# AES Competições

Aplicação web para apoiar a organização das competições da AES, desenvolvida como projeto de extensão do curso de Engenharia de Software por **Gabriel de Souza Moreira**.

O projeto surgiu da necessidade de transformar controles realizados em planilhas Excel em uma interface para cadastrar participantes, organizar confrontos, registrar resultados e acompanhar classificações.

**Acesse a aplicação:** [aes-competicoes.onrender.com](https://aes-competicoes.onrender.com)

> **Escopo atual: somente futsal e damas possuem módulos esportivos implementados.** Outras modalidades podem aparecer no cadastro ou na interface como previstas, mas ainda não possuem seus próprios fluxos de jogos e classificação.

## Funcionalidades

### Recursos gerais

- Cadastro de competições, com modalidade, categoria, edição, data e local.
- Armazenamento dos registros no navegador.
- Exportação e importação de backups em JSON.
- Inscrições para confraternização por etapa, vinculadas a uma escola ou unidade.
- Configuração de preços por categoria e faixa etária.
- Consulta de direito à hospedagem conforme os critérios esportivos implementados.

A consulta de hospedagem **não reserva nem distribui quartos**. O cadastro na confraternização também não inscreve automaticamente a pessoa como atleta.

### Futsal

O módulo atende ao formato específico adotado neste projeto, com **10 equipes distribuídas em dois grupos de cinco**. Não é um gerador genérico para qualquer regulamento.

- Cadastro de equipes e inscrições de atletas.
- Limite inicial de 11 atletas ativos por equipe, configurável por competição.
- Verificação etária do Futsal Master pelo ano de nascimento.
- Organização dos grupos e dos confrontos previstos no formato da AES.
- Registro de placares e sorteios aplicáveis aos jogos iniciais.
- Classificação por pontos, saldo de gols, gols marcados e gols sofridos, com sorteio quando necessário.
- Fase regional com quatro confrontos classificatórios.
- Decisão por pênaltis quando houver empate nos confrontos eliminatórios.
- Etapa da colônia com sorteio das semifinais, disputa de terceiro lugar e final.
- Registro de participações e exceções previstas para verificar aptidão à etapa da colônia.

### Damas

O fluxo integrado contempla **inscrições → regional única → dois classificados → final na colônia**.

- Inscrições individuais com escola/unidade, ano de nascimento, documento e vínculo.
- Identificação do associado relacionado quando exigida pelo vínculo.
- Confrontos em formato todos contra todos em cada etapa.
- Três partidas regulares por confronto, sempre disputadas.
- Registro do resultado e das peças restantes de cada jogador.
- Definição do vencedor do confronto pelo número de vitórias nas partidas e, em caso de empate, pela soma das peças restantes.
- Registro de partidas extras quando persistir o empate.
- Classificação por vitórias em confrontos e, depois, pelo total de peças restantes nas partidas regulares.
- Registro de desempates adicionais e da ordem definida pela organização.
- Encerramento da regional e transferência dos dois primeiros para a final.
- Resultados separados por etapa: a final começa sem os resultados da regional.
- Impressão da classificação.

As peças das partidas extras não entram no total das partidas regulares. O sistema registra e organiza os resultados; não oferece um tabuleiro jogável nem arbitra movimentos.

## Como os dados são armazenados

A aplicação utiliza **IndexedDB**, um banco de dados local do navegador. Não há banco central no servidor, login ou sincronização entre dispositivos.

Isso significa que:

- Cada navegador e perfil mantém seus próprios registros.
- Abrir o link em outro computador não mostra automaticamente os dados cadastrados no primeiro.
- Os dados de `localhost` são separados dos dados do endereço publicado.
- Limpar os dados do site ou perder o perfil do navegador pode apagar os registros.
- A hospedagem da aplicação não funciona como backup das competições.

**Exporte backups regularmente**, especialmente depois de cadastrar inscrições ou lançar resultados. Para transferir registros entre ambientes, exporte no navegador de origem e importe no destino.

A importação preserva a competição local quando já existe outra com o mesmo identificador. Portanto, **não funciona como sincronização nem substitui automaticamente registros existentes**.

## Orientações para avaliação acadêmica

1. Acesse [a aplicação publicada](https://aes-competicoes.onrender.com).
2. Cadastre uma competição de **Damas** ou **Futsal**, ou importe um backup de demonstração fornecido junto à entrega.
3. Percorra as inscrições, os confrontos e a classificação.
4. Exporte um backup para conservar o cenário testado.

Em um navegador sem registros anteriores, a lista de competições começa vazia. Isso é esperado.

Utilize dados fictícios na demonstração. Não publique backups contendo documentos ou outros dados pessoais dos participantes no repositório.

## Tecnologias

- **TypeScript** — lógica da aplicação e regras das competições.
- **Vite** — ambiente de desenvolvimento e geração da versão de publicação.
- **HTML e CSS** — interface.
- **IndexedDB** — persistência local.
- **Render Static Site** — hospedagem da aplicação publicada.

O projeto atual executa no navegador e não utiliza Django ou PostgreSQL.

## Executar localmente

Pré-requisitos: Node.js e npm instalados. O projeto foi desenvolvido utilizando Node.js 24.

Depois de clonar ou baixar o repositório, abra um terminal na pasta que contém o `package.json` e execute:

```bash
npm ci
npm run dev
```

Abra o endereço informado pelo terminal, normalmente `http://localhost:5173`.

No Windows, caso o PowerShell bloqueie o script `npm.ps1`, utilize:

```powershell
npm.cmd ci
npm.cmd run dev
```

### Gerar a versão de publicação

```bash
npm run build
```

Os arquivos gerados ficam na pasta `dist`.

## Publicação no Render

Configuração utilizada para publicar o projeto a partir do repositório:

| Campo | Valor |
|---|---|
| Tipo de serviço | Static Site |
| Branch | `main` |
| Root Directory | Vazio, quando o projeto está na raiz do repositório |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |

A aplicação não exige variáveis de ambiente nem um banco de dados no Render.

## Limites desta versão

- Apenas **futsal e damas** têm regras e fluxos esportivos implementados.
- Os formatos refletem os requisitos levantados para a AES; não abrangem todo regulamento possível dessas modalidades.
- Não há contas de usuário, permissões de acesso ou edição compartilhada entre computadores.
- Não há reserva de quartos nem processamento de pagamentos.
- A preservação dos registros depende do navegador e dos backups exportados.

## Autor e finalidade

**Gabriel de Souza Moreira**  
Projeto de extensão — Engenharia de Software.

Desenvolvido para apoiar a organização esportiva da AES e demonstrar a aplicação de conhecimentos de desenvolvimento de software a uma necessidade prática da comunidade.

