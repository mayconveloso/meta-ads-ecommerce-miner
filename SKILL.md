---
name: meta-ads-ecommerce-miner
description: Mine public Meta/Facebook Ads Library results for ecommerce advertisers using Playwright keyword searches, dedupe by Library ID, and generate JSONL/CSV/Markdown outputs.
version: 1.0.0
author: Maycon Veloso
license: MIT
metadata:
  tags: [meta-ads-library, facebook-ads-library, ecommerce, ad-research, playwright]
---

# Meta Ads Ecommerce Miner

## Quando usar

Use esta skill quando quiser encontrar anúncios e anunciantes de e-commerce na Meta Ads Library para pesquisa competitiva, inspiração de copy, ângulos de oferta e mapeamento de mercado.

## Escopo

- Pesquisa pública na Meta Ads Library.
- Busca por palavras-chave de e-commerce.
- Extração via Playwright + Chromium.
- Deduplicação por `Library ID`.
- Saídas em JSONL, CSV e Markdown.

## Setup

```bash
git clone https://github.com/mayconveloso/meta-ads-ecommerce-miner.git
cd meta-ads-ecommerce-miner
npm install
npx playwright install chromium
npm test
```

Se o navegador reclamar de biblioteca ausente no Linux:

```bash
npx playwright install chromium --with-deps
```

## Execução básica

```bash
npm run mine -- \
  --queries examples/ecommerce-queries.br.json \
  --country BR \
  --days 30 \
  --max-scrolls 8 \
  --out output/br-30d
```

## Processo operacional

1. Comece por 5–10 queries de oferta ampla.
2. Rode com `--max-scrolls 6` ou `8`.
3. Abra `ads.csv`.
4. Ordene por `ecommerce_score`.
5. Recolha frases reais dos melhores anúncios.
6. Crie nova onda de queries com essas frases.
7. Gere um relatório manual com os melhores anunciantes, copies e domínios.

## Queries que costumam funcionar

- `frete grátis hoje`
- `compre agora desconto`
- `últimas unidades promoção`
- `pague 2 leve 3`
- `loja oficial promoção`
- `buy 1 get 1 free`
- `free shipping today`
- `50% off today`
- `shop now limited offer`
- `ends tonight sale`

## Campos principais

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

## Critério de qualidade

Um bom candidato geralmente tem:

- oferta clara;
- CTA de compra;
- desconto, bundle, frete ou urgência;
- domínio próprio ou plataforma de loja;
- várias variações criativas;
- copy reutilizável como padrão, não como plágio.

## Verificação

```bash
npm test
npm run smoke
```

Após uma rodada real:

```bash
wc -l output/br-30d/ads.jsonl
head -5 output/br-30d/ads.csv
```

## Limitações

- A Ads Library muda com frequência.
- Algumas informações ficam fora do texto renderizado.
- Resultado vazio pode ser falha de query, país, janela ou indexação.
- Não assuma performance a partir da existência do anúncio; use como sinal de mercado e volume criativo.
