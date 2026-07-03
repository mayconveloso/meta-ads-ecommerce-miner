# Meta Ads Ecommerce Miner

Ferramenta simples para o Túlio minerar anúncios de e-commerce na Meta Ads Library usando busca por palavras-chave e Playwright.

O objetivo é capturar anúncios públicos da biblioteca, deduplicar por `Library ID` e gerar arquivos fáceis de analisar: JSONL, CSV e um resumo em Markdown.

## O que ela faz

- Abre a Meta Ads Library pelo Chromium controlado pelo Playwright.
- Roda uma lista de queries de e-commerce.
- Faz scroll para carregar mais cards.
- Extrai `Library ID`, anunciante, data, quantidade de criativos, texto do anúncio, links e imagens quando disponíveis no card.
- Calcula um `ecommerce_score` simples com sinais como desconto, frete, compra, produto, loja, checkout e CTA.
- Salva:
  - `ads.jsonl` — dados completos, uma linha por anúncio;
  - `ads.csv` — planilha rápida para filtrar;
  - `summary.md` — resumo por query e por anunciante.

## Dependências

### Obrigatórias

1. **Node.js 20+**
   - Testado com Node 22.
   - Verifique com:
     ```bash
     node --version
     npm --version
     ```

2. **Chromium do Playwright**
   - Não precisa instalar Chrome manualmente.
   - O Playwright baixa o navegador necessário.

### Instalação

```bash
git clone https://github.com/mayconveloso/meta-ads-ecommerce-miner.git
cd meta-ads-ecommerce-miner
npm install
npx playwright install chromium
```

No Linux limpo, se faltar dependência de sistema do navegador, rode:

```bash
npx playwright install chromium --with-deps
```

## Teste rápido

```bash
npm test
npm run smoke
```

Se isso imprimir a tela de ajuda do minerador, o projeto está pronto para rodar.

## Como rodar

### Brasil

```bash
npm run mine -- \
  --queries examples/ecommerce-queries.br.json \
  --out output/br-90d
```

### Estados Unidos / internacional

```bash
npm run mine -- \
  --queries examples/ecommerce-queries.us.json \
  --country US \
  --days 90 \
  --out output/us-90d
```

### Query única

```bash
npm run mine -- \
  --query "buy 1 get 1 free" \
  --country US \
  --days 14 \
  --out output/bogo-us
```

### Ver o navegador abrindo

Útil para diagnosticar se a página mudou ou se a conexão está ruim:

```bash
npm run mine -- \
  --queries examples/ecommerce-queries.br.json \
  --headful \
  --slow 150 \
  --out output/debug-br
```

## Arquivo de queries

Formato aceito:

```json
[
  {
    "query": "frete grátis promoção",
    "market": "BR",
    "tags": ["discount", "shipping"],
    "note": "Busca ampla para ofertas com frete grátis"
  },
  {
    "query": "buy 1 get 1 free",
    "market": "US",
    "tags": ["bogo"]
  }
]
```

Também funciona com uma lista simples de strings:

```json
[
  "frete grátis promoção",
  "compre agora desconto",
  "buy 1 get 1 free"
]
```

## Parâmetros principais

| Parâmetro | Padrão | Uso |
|---|---:|---|
| `--queries` | — | Caminho para JSON com queries |
| `--query` | — | Uma query manual |
| `--country` | `BR` | País da Ads Library: `BR`, `US`, `GB`, `ALL` etc. |
| `--days` | `90` | Janela de data retroativa |
| `--date-min` | — | Data mínima fixa `YYYY-MM-DD`; substitui o cálculo por `--days` |
| `--date-max` | hoje | Data máxima fixa `YYYY-MM-DD` |
| `--active-status` | `active` | `all`, `active` ou `inactive` |
| `--media-type` | `all` | `all`, `image`, `video`, `memes`, etc. conforme aceito pela Meta |
| `--max-scrolls` | `12` | Número máximo de scrolls por query |
| `--initial-wait-ms` | `8000` | Espera inicial para a página renderizar antes do primeiro scrape |
| `--min-wait-ms` | `1400` | Espera base depois de cada scroll |
| `--plateau-limit` | `5` | Para quando o número de cards não cresce por N ciclos |
| `--scroll-pixels` | `3600` | Distância do scroll por ciclo |
| `--user-agent` | Chrome Linux | User agent customizado, se precisar testar outro navegador |
| `--min-score` | `1` | Score mínimo para salvar um card |
| `--limit-per-query` | `0` | Limite de cards por query; `0` = sem limite local |
| `--out` | `output/run-...` | Pasta de saída |
| `--headful` | `false` | Abre o navegador visível |
| `--slow` | `0` | Delay em ms entre ações do Playwright |

## Saídas

### `ads.jsonl`

Uma linha JSON por anúncio. Bom para processamento.

Campos principais:

- `library_id`
- `query`
- `advertiser`
- `started_running`
- `creative_count`
- `ad_text`
- `links`
- `link_domains`
- `images`
- `ecommerce_score`
- `ecommerce_signals`
- `captured_at`

### `ads.csv`

Planilha para abrir no Google Sheets, Excel ou Numbers.

### `summary.md`

Resumo operacional com:

- total de anúncios únicos;
- top anunciantes;
- resultado por query;
- top anúncios por score.

## Estratégia de queries para e-commerce

Comece com queries que parecem texto real de anúncio, não só nome de nicho.

Boas famílias:

- Oferta: `50% off today`, `buy 1 get 1 free`, `últimas unidades`, `pague 2 leve 3`
- Frete: `free shipping today`, `frete grátis hoje`
- Urgência: `ends tonight`, `só hoje`, `last chance`
- Produto + benefício: `posture corrector discount`, `kit skincare promoção`, `pet hair remover free shipping`
- Loja/checkout: `loja oficial promoção`, `shop now limited offer`

Rode poucas queries primeiro, olhe o CSV, depois expanda as que trouxerem anunciantes bons.

## Limitações

- A Meta pode mudar a estrutura visual da Ads Library; se a extração cair, rode com `--headful` para diagnosticar.
- Nem todo card expõe link final, imagem ou texto completo.
- Vídeos normalmente não aparecem como arquivo baixável direto no HTML renderizado.
- Os dados são públicos e variam por país, status do anúncio e janela de data.
- Resultado vazio em uma query não prova que o anunciante não anuncia; pode ser só query ruim ou indexação fraca.

## Fluxo recomendado para o Túlio

1. Rodar `npm test`.
2. Rodar 5 a 10 queries amplas.
3. Abrir `ads.csv`.
4. Filtrar por `ecommerce_score` e por domínio.
5. Separar anunciantes promissores.
6. Criar novas queries usando frases reais encontradas nos melhores anúncios.
7. Repetir em ondas menores.

## Uso responsável

Use somente para pesquisa competitiva e inspiração. Não copie criativos, marcas, claims ou páginas de concorrentes. Use os padrões encontrados para criar ângulos próprios.
