# markdown-i18n

Maintain one Markdown source and compile localized README files.

## Why

:::lang en
This project keeps documentation translations in one source file.
:::

:::lang es
Este proyecto mantiene las traducciones de la documentacion en un solo archivo fuente.
:::

:::lang pt
Este projeto mantem as traducoes da documentacao em um unico arquivo fonte.
:::

## Installation

<!-- i18n-ignore-start -->
```bash
npm install
```
<!-- i18n-ignore-end -->

## Example

:::lang en,es
Shared content for English and Spanish.
:::

:::lang pt
Conteudo especifico para portugues.
:::

```js
const marker = ":::lang en";
```
