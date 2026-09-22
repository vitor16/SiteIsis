/* Hair-only recoloring with Google's MediaPipe Hair Segmenter. Photos stay local. */
window.HairStudio = (() => {
  const byId = id => document.getElementById(id);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  const cache = new Map();
  let enginePromise, previewPromise, serial = 0, uploadSerial = 0;
  let active = null, source = null, uploaded = null, mode = 'model', model = 'waves';
  let settings = {}, showOriginal = false, frame = 0;
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const smooth = v => {v = clamp(v); return v * v * (3 - 2 * v);};
  const waitPaint = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 30)));
  function message(text, error = false) {
    byId('hairFeedback').textContent = text;
    byId('hairFeedback').classList.toggle('is-error', error);
  }
  function busy(value) {
    byId('hairProcessing').hidden = !value;
    byId('hairViewport').setAttribute('aria-busy', value);
    byId('downloadHair').disabled = value || !active;
  }
  function script(url) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');el.src = url;
      el.onload = resolve;el.onerror = () => {el.remove();reject(new Error('Não foi possível carregar a IA.'));};
      document.head.appendChild(el);
    });
  }
  async function engine() {
    if (!enginePromise) enginePromise = (async () => {
      if (!window.IsisVision) await script('assets/ai/vision-browser.js');
      const fileMode = location.protocol === 'file:';
      const wasmBase = fileMode ? 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm' : 'assets/ai';
      const modelPath = fileMode ? 'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite' : 'assets/ai/hair_segmenter.tflite';
      const files = await IsisVision.FilesetResolver.forVisionTasks(wasmBase);
      return IsisVision.ImageSegmenter.createFromOptions(files, {
        baseOptions: {modelAssetPath: modelPath, delegate: 'CPU'},
        runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true
      });
    })().catch(error => {enginePromise = null;throw error;});
    return enginePromise;
  }
  async function modelSource(key) {
    // Embedded previews avoid file:// canvas security restrictions; hosted pages use ordinary assets.
    if (location.protocol === 'file:') {
      if (!previewPromise) previewPromise = script('assets/model-previews.js').catch(e => {previewPromise = null;throw e;});
      await previewPromise;return window.IsisModelPreviews[key];
    }
    return `model_${key}.jpg`;
  }
  async function analyze(img) {
    const ai = await engine();
    const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * scale);canvas.height = Math.round(img.naturalHeight * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let maskCanvas = document.createElement('canvas'), maskCtx = maskCanvas.getContext('2d');
    ai.segment(canvas, result => {
      const labels = ai.getLabels();
      let hairIndex = labels.findIndex(label => /hair/i.test(label));
      if (hairIndex < 0) hairIndex = result.confidenceMasks.length === 1 ? 0 : 1;
      const mask = result.confidenceMasks[hairIndex];
      maskCanvas.width = mask.width;maskCanvas.height = mask.height;
      const confidence = mask.getAsFloat32Array(), data = maskCtx.createImageData(mask.width, mask.height);
      for (let i = 0; i < confidence.length; i++) {
        data.data[i * 4] = 255;data.data[i * 4 + 1] = 255;data.data[i * 4 + 2] = 255;
        data.data[i * 4 + 3] = Math.round(smooth((confidence[i] - .30) / .55) * 255);
      }
      maskCtx.putImageData(data, 0, 0);
    });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
    const mask = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0, sum = 0, top = canvas.height, bottom = 0, left = canvas.width, right = 0;
    for (let i = 0; i < mask.length; i += 4) if (mask[i + 3] > 160) {
      const x = (i / 4) % canvas.width, y = Math.floor(i / 4 / canvas.width);
      count++;sum += .2126 * pixels.data[i] + .7152 * pixels.data[i + 1] + .0722 * pixels.data[i + 2];
      top = Math.min(top, y);bottom = Math.max(bottom, y);left = Math.min(left, x);right = Math.max(right, x);
    }
    if (count < canvas.width * canvas.height * .003) throw new Error('Não encontrei cabelo suficiente. Tente uma foto mais próxima, com o cabelo visível e boa iluminação.');
    return {pixels, mask, mean: sum / count, top, bottom, left, right};
  }
  async function load(nextSource, key) {
    const ticket = ++serial;source = {url: nextSource, key};active = null;
    byId('hairResultCanvas').hidden = true;byId('retryHair').hidden = true;
    original(false);busy(true);message('A IA está identificando o cabelo. A primeira vez pode levar alguns segundos.');
    const img = new Image();img.src = nextSource;
    try {
      await img.decode();if (ticket !== serial) return;
      byId('mainHairPhoto').src = nextSource;
      byId('mainHairPhoto').alt = mode === 'upload' ? 'Sua foto para simulação capilar' : 'Modelo para simulação capilar';
      await waitPaint();if (ticket !== serial) return;
      let data = cache.get(key);
      if (!data) { data = await analyze(img);if (ticket !== serial) return;cache.set(key, data); }
      active = data;render(settings);busy(false);
      message('Prévia pronta. A cor acompanha o cabelo e preserva a textura dos fios.');
    } catch (error) {
      if (ticket !== serial) return;
      active = null;busy(false);byId('retryHair').hidden = false;
      message(error.message.includes('cabelo suficiente') ? error.message : 'Não foi possível iniciar a simulação. Confira sua conexão e tente novamente. Sua foto original foi preservada.', true);
      console.warn('Hair simulation:', error);
    }
  }
  async function setMode(nextMode, key = model) {
    mode = nextMode;model = key;uploadSerial++;
    const ticket = ++serial;
    byId('clientUploadPrompt').style.display = mode === 'upload' && !uploaded ? 'flex' : 'none';
    byId('replacePhoto').hidden = mode !== 'upload' || !uploaded;
    if (mode === 'upload') {
      if (uploaded) return load(uploaded.url, uploaded.key);
      active = null;source = null;busy(false);byId('hairResultCanvas').hidden = true;byId('retryHair').hidden = true;
      message('Envie uma foto para experimentar sua próxima cor.');return;
    }
    byId('hairResultCanvas').hidden = true;active = null;busy(true);
    try {const url = await modelSource(key);if (ticket === serial) return load(url, key);}
    catch (error) {if (ticket === serial) {busy(false);message('Não foi possível abrir a modelo. Tente novamente.',true);byId('retryHair').hidden = false;}}
  }
  async function upload(file) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {message('Escolha uma imagem JPG, PNG ou WebP.', true);return;}
    if (file.size > 20 * 1024 * 1024) {message('A foto deve ter até 20 MB. Escolha uma versão menor.', true);return;}
    const ticket = ++uploadSerial, url = URL.createObjectURL(file), image = new Image();image.src = url;
    try {
      await image.decode();
      if (ticket !== uploadSerial) {URL.revokeObjectURL(url);return;}
      if (image.naturalWidth < 80 || image.naturalHeight < 80) throw new Error('small');
      if (uploaded) {cache.delete(uploaded.key);URL.revokeObjectURL(uploaded.url);}
      uploaded = {url, key: 'upload-' + ticket};window.setHairSimMode('upload');
    } catch (error) {URL.revokeObjectURL(url);if (ticket === uploadSerial) message('Não consegui abrir essa foto. Escolha outra imagem JPG, PNG ou WebP com boa resolução.',true);}
  }
  function render(nextSettings) {
    settings = nextSettings;cancelAnimationFrame(frame);
    if (!active || !settings.hex) return;
    frame = requestAnimationFrame(() => {
      if (!active) return;
      const {pixels, mask, mean, top, bottom, left, right} = active;
      const out = new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
      const rgb = settings.hex.match(/[a-f\d]{2}/gi).map(v => parseInt(v,16));
      for (let i = 0; i < out.data.length; i += 4) {
        if (!mask[i + 3]) continue;
        const x = (i / 4) % pixels.width, y = Math.floor(i / 4 / pixels.width);
        const height = clamp((y - top) / Math.max(1, bottom - top));
        const side = Math.abs((x - left) / Math.max(1, right - left) - .5) * 2;
        let placement = 1;
        if (settings.technique === 'balayage') placement = .15 + .85 * smooth((height - .12) / .7);
        if (settings.technique === 'ombre') placement = smooth((height - .30) / .60);
        if (settings.technique === 'babylights') placement = .25 + .65 * Math.pow((Math.sin(x * .24 + Math.sin(y * .009) * 3) + 1) / 2, 3);
        if (settings.technique === 'contour') placement = .15 + .8 * smooth(side);
        if (settings.technique === 'gloss') placement = .40;
        const lum = .2126 * pixels.data[i] + .7152 * pixels.data[i+1] + .0722 * pixels.data[i+2];
        const shade = clamp(Math.pow(lum / Math.max(85, mean), .8), .15, 2.0);
        const highlight = Math.max(0, lum - mean * 1.4) * settings.gloss * .23;
        const alpha = mask[i + 3] / 255 * settings.intensity * placement;
        for (let c = 0; c < 3; c++) {
          const tinted = clamp(rgb[c] * shade * .88 + highlight, 0, 255);
          out.data[i+c] = pixels.data[i+c] * (1 - alpha) + tinted * alpha;
        }
      }
      const result = byId('hairResultCanvas');result.width = pixels.width;result.height = pixels.height;
      result.getContext('2d').putImageData(out, 0, 0);result.hidden = showOriginal;
    });
  }
  function original(value) {
    showOriginal = value;byId('hairResultCanvas').hidden = value || !active;
    const button = byId('btnHoldCompare');button.setAttribute('aria-pressed', value);
    button.textContent = value ? 'Ver simulação' : 'Ver original';
  }
  function download() {
    if (!active) return;
    const a = document.createElement('a');a.download = 'minha-cor-isis-avelar.png';a.href = byId('hairResultCanvas').toDataURL('image/png');a.click();
  }
  return {setMode, upload, render, original, toggleOriginal: () => original(!showOriginal), download,
    retry: () => source ? load(source.url, source.key) : setMode(mode, model)};
})();
