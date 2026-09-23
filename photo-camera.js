/* Camera photos enter the same local processing pipeline as file uploads. */
window.PhotoCamera = (() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'photo-camera';
  dialog.setAttribute('aria-labelledby', 'cameraTitle');
  dialog.innerHTML = `<div class="camera-heading"><h3 id="cameraTitle">Tirar sua foto</h3><button type="button" class="hair-btn-tool" data-close aria-label="Fechar câmera">✕</button></div>
    <p data-status role="status">Abrindo câmera…</p>
    <video autoplay muted playsinline aria-label="Prévia da câmera"></video>
    <div class="camera-buttons"><button type="button" class="btn-cta" data-snap disabled>Tirar foto</button><button type="button" class="hair-btn-tool" data-switch>Trocar câmera</button><button type="button" class="hair-btn-tool" data-native>Usar câmera do celular</button></div>
    <small>A foto é processada somente no seu dispositivo.</small>`;
  document.body.append(dialog);
  const video = dialog.querySelector('video'), status = dialog.querySelector('[data-status]');
  const snap = dialog.querySelector('[data-snap]');
  const nativeInput = document.createElement('input');
  nativeInput.type = 'file'; nativeInput.accept = 'image/*'; nativeInput.hidden = true;
  document.body.append(nativeInput);
  let stream, target, facing, revision = 0;
  function stop() {
    revision++;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null; video.srcObject = null; snap.disabled = true;
  }
  function close() { stop(); dialog.close(); }
  function deliver(file, destination) {
    if (destination === 'hair') HairStudio.upload(file);
    else NailStudio.upload(file);
  }
  async function start() {
    stop();
    const ticket = revision;
    status.textContent = 'Abrindo câmera… Permita o acesso quando o navegador pedir.';
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
      const next = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: {ideal: facing}, width: {ideal: 1280}, height: {ideal: 960}}});
      if (ticket !== revision || !dialog.open) { next.getTracks().forEach(track => track.stop()); return; }
      stream = next; video.srcObject = next;
      await video.play();
      if (ticket !== revision) return;
      video.style.transform = next.getVideoTracks()[0].getSettings().facingMode === 'user' ? 'scaleX(-1)' : '';
      snap.disabled = false;
      status.textContent = target === 'hair' ? 'Enquadre o cabelo inteiro em um lugar bem iluminado.' : 'Aproxime a mão e deixe todas as unhas visíveis, com boa iluminação.';
    } catch (error) {
      if (ticket !== revision) return;
      stop();
      status.textContent = error.name === 'NotAllowedError' ? 'A câmera não foi autorizada. Permita o acesso nas configurações do navegador ou use uma foto da galeria.' : 'Não foi possível abrir a câmera aqui. No celular, tente o botão abaixo; ou feche e selecione uma foto da galeria.';
    }
  }
  dialog.querySelector('[data-close]').onclick = close;
  dialog.addEventListener('cancel', close);
  dialog.addEventListener('close', stop);
  dialog.querySelector('[data-switch]').onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; start(); };
  dialog.querySelector('[data-native]').onclick = () => { stop(); nativeInput.setAttribute('capture', facing); nativeInput.click(); };
  nativeInput.onchange = () => { const file = nativeInput.files[0], destination = target; nativeInput.value = ''; if (file) {close(); deliver(file, destination);} };
  snap.onclick = () => {
    if (!video.videoWidth || !video.videoHeight) return;
    snap.disabled = true;
    const destination = target, ticket = revision, canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (ticket !== revision || !dialog.open) return;
      if (!blob) { status.textContent = 'Não consegui capturar. Tente novamente.'; snap.disabled = false; return; }
      close(); deliver(new File([blob], 'foto-camera.jpg', {type: 'image/jpeg'}), destination);
    }, 'image/jpeg', .94);
  };
  window.addEventListener('pagehide', close);
  return {open(destination) { target = destination; facing = target === 'hair' ? 'user' : 'environment'; if (!dialog.open) dialog.showModal(); start(); }};
})();
