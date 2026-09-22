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

O número de WhatsApp ainda é o placeholder `5500000000000` do projeto original; deve ser substituído pelo número do salão antes de publicar.
