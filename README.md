# Isis Avelar Stúdio

Site estático do salão, com portfólio real e simuladores de cabelo e unhas.

## Prévia local

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Abra http://127.0.0.1:8765. Para publicar, envie `index.html`, `studio.css`, `hair-studio.js`, `assets/`, `fotos/` e as imagens da raiz ao mesmo servidor estático. Não há backend, chave de API ou cobrança de inferência.

Também é possível abrir `index.html` diretamente. Nesse modo, o navegador usa as prévias embutidas em `assets/model-previews.js` e baixa o runtime WASM e o modelo dos servidores públicos do jsDelivr/Google. A conexão é necessária para esse primeiro carregamento. Em HTTP(S), todos os arquivos da IA são servidos pelo próprio site.

## Simulação capilar

- MediaPipe Tasks Vision **0.10.32**, modelo **Hair Segmenter float32 v1**.
- A IA identifica a área do cabelo. A composição em canvas aplica a cor nessa área e preserva os detalhes de iluminação e textura. Não gera penteados nem muda cortes.
- Fotografias são decodificadas e processadas no dispositivo; não são enviadas a um serviço de IA. As URLs temporárias são liberadas ao trocar a foto.
- JPG, PNG e WebP de até 20 MB. Processamento limitado a 900 pixels no maior lado; resultados das quatro modelos e da foto atual ficam em cache durante a sessão.
- O carregamento da IA começa quando a seção se aproxima da tela. São exibidos estados de processamento, falha, tentativa novamente e cabelo não encontrado.
- A prévia é ilustrativa: iluminação, cabelo de base, contornos e detecção podem alterar o resultado. Balayage, babylights e ombré são aproximações visuais sobre a região segmentada.

Referências: [guia oficial de segmentação para Web](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js), [modelo de cabelo](https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite). Licença do runtime em `assets/ai/LICENSE`; versão e metadados em `assets/ai/package-info.json`. `vision-browser.js` contém o bundle CommonJS original, envolvido em uma função que expõe `window.IsisVision` para permitir uso sem bundler e em `file://`.

## Validação realizada

Chrome headless: quatro modelos, upload de foto do salão, seleção real pelo input de arquivo, troca entre modelo e foto mantendo a imagem enviada, comparação original/simulação, arquivo inválido, limite de tamanho, foto sem cabelo e recuperação. Verificadas as larguras 320, 390, 768, 1024 e 1440, navegação móvel e abertura HTTP e file://. Sem exceções JavaScript ou caminhos de imagem ausentes.

Contato atualizado a partir dos prints fornecidos: +55 27 99289-4284; Rua Antônio Pagari, 1, Enseada Jacaraípe, Serra – ES, CEP 29175-337. Atendimento de terça a sábado, 9h–18h; fechado domingo e segunda. O formulário solicita confirmação de disponibilidade pelo WhatsApp e bloqueia dias fechados.

## Portfólio compacto e unhas em foto

- `portfolio.js`: carrossel com 15 trabalhos e todas as 57 fotos originais, navegação por setas, seletor, teclado e gesto horizontal. O comparador inicial foi preservado.
- `nail-studio.js`: quatro mãos modelo fornecidas pelo usuário, upload JPG/PNG/WebP (até 20 MB), segmentação de unhas em worker, troca de esmalte/intensidade, comparação e download. Comprimento e formato são preferências enviadas ao WhatsApp; a prévia em foto altera a cor.
- Distribua também `portfolio.js`, `nail-studio.js` e `assets/nails/` ao publicar. Modelo e runtime carregados sob demanda, com aproximadamente 56 MB na primeira inicialização. Os resultados ficam em cache na sessão.
- Fontes, licenças e limites da detecção em [assets/nails/README.md](assets/nails/README.md).
