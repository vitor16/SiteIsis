/* Photo nail try-on. Inference runs in a worker; photos never leave the device. */
window.NailStudio = (() => {
  const $=id=>document.getElementById(id), cache=new Map();
  let mode='model', model='classic', uploaded, source, active, serial=0, uploadSerial=0;
  let worker, workerURL, pending=new Map(), job=0, previewsPromise, started=false;
  let hex='#d50000', intensity=.85, original=false, frame;
  const clamp=v=>Math.max(0,Math.min(1,v));
  function message(text,error=false){$('nailFeedback').textContent=text;$('nailFeedback').classList.toggle('is-error',error);}
  function busy(value){$('nailProcessing').hidden=!value;$('nailViewport').setAttribute('aria-busy',value);$('nailDownload').disabled=value||!active;$('nailCompare').disabled=value||!active;}
  function loadScript(url){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('assets'));};document.head.appendChild(s);});}
  // Self-contained worker function: all downloaded model data is public; no uploaded image is transmitted.
  function workerMain(){
    let sessionPromise;
    async function getSession(config){
      if(!sessionPromise) sessionPromise=(async()=>{
        importScripts(config.runtime);
        ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=config.wasm;
        return ort.InferenceSession.create(config.model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
      })().catch(e=>{sessionPromise=null;throw e;});
      return sessionPromise;
    }
    const overlap=(a,b)=>{
      const inter=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
      return inter/((a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-inter+1e-6);
    };
    let queue=Promise.resolve();
    self.onmessage=e=>{const task=e.data;queue=queue.then(async()=>{
      try{
        const session=await getSession(task.config);
        const input=new ort.Tensor('float32',new Float32Array(task.tensor),[1,3,768,768]);
        const result=await session.run({[session.inputNames[0]]:input});
        const det=result[session.outputNames[0]], proto=result[session.outputNames[1]];
        const n=det.dims[2], channels=proto.dims[1], height=proto.dims[2], width=proto.dims[3], plane=width*height;
        const candidates=[];
        for(let i=0;i<n;i++){
          if(det.data[4*n+i]<.40)continue;
          const cx=det.data[i],cy=det.data[n+i],w=det.data[2*n+i],h=det.data[3*n+i];
          candidates.push({i,score:det.data[4*n+i],box:[cx-w/2,cy-h/2,cx+w/2,cy+h/2]});
        }
        candidates.sort((a,b)=>b.score-a.score);
        const nails=[];
        for(const candidate of candidates)if(nails.length<10&&!nails.some(nail=>overlap(nail.box,candidate.box)>.4))nails.push(candidate);
        const mask=new Uint8ClampedArray(plane);
        for(const nail of nails){
          const x0=Math.max(0,Math.floor(nail.box[0]*width/768)),x1=Math.min(width,Math.ceil(nail.box[2]*width/768));
          const y0=Math.max(0,Math.floor(nail.box[1]*height/768)),y1=Math.min(height,Math.ceil(nail.box[3]*height/768));
          for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
            const index=y*width+x;let logit=0;
            for(let c=0;c<channels;c++)logit+=det.data[(5+c)*n+nail.i]*proto.data[c*plane+index];
            const alpha=1/(1+Math.exp(-logit));
            mask[index]=Math.max(mask[index],Math.round(alpha*255));
          }
        }
        input.dispose();det.dispose();proto.dispose();
        self.postMessage({id:task.id,mask:mask.buffer,width,height,count:nails.length},[mask.buffer]);
      }catch(error){self.postMessage({id:task.id,error:String(error)});}
    });};
  }
  function inference(tensor){
    if(!worker){
      workerURL=URL.createObjectURL(new Blob([`(${workerMain.toString()})()`],{type:'text/javascript'}));
      worker=new Worker(workerURL);
      worker.onmessage=e=>{const item=pending.get(e.data.id);if(item){clearTimeout(item.timer);pending.delete(e.data.id);e.data.error?item.reject(Error(e.data.error)):item.resolve(e.data);}};
      worker.onerror=()=>resetWorker(Error('worker'));
    }
    const local=location.protocol!=='file:',cdn='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
    const base=new URL('assets/nails/',location.href).href;
    const config={runtime:local?base+'ort.min.js':cdn+'ort.wasm.min.js',wasm:local?base:cdn,model:local?base+'nail-segmentation.onnx':'https://huggingface.co/spaces/hzaustingg/Fingernail-segmentation-Demo/resolve/main/models/nail-seg.onnx'};
    return new Promise((resolve,reject)=>{const id=++job;const timer=setTimeout(()=>resetWorker(Error('timeout')),90000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,tensor:tensor.buffer,config},[tensor.buffer]);});
  }
  function resetWorker(error){worker?.terminate();worker=null;if(workerURL)URL.revokeObjectURL(workerURL);pending.forEach(p=>{clearTimeout(p.timer);p.reject(error);});pending.clear();}
  async function modelSource(key){
    if(location.protocol!=='file:')return `assets/nails/hand-${key}.png`;
    if(!previewsPromise)previewsPromise=loadScript('assets/nails/model-previews.js').catch(e=>{previewsPromise=null;throw e;});
    await previewsPromise;return window.IsisNailPreviews[key];
  }
  // Refine soft probabilities at photo resolution using RGB edges as guidance.
  // This avoids sharpening the coarse 192px mask before it is enlarged.
  function refineNailMask(pixels, mask) {
    const w=pixels.width,h=pixels.height,n=w*h,r=4;
    function mean(values) {
      const stride=w+1, integral=new Float64Array((w+1)*(h+1)),out=new Float32Array(n);
      for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=values[y*w+x];integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;}}
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const l=Math.max(0,x-r),t=Math.max(0,y-r),right=Math.min(w,x+r+1),bottom=Math.min(h,y+r+1);
        out[y*w+x]=(integral[bottom*stride+right]-integral[t*stride+right]-integral[bottom*stride+l]+integral[t*stride+l])/((right-l)*(bottom-t));
      }
      return out;
    }
    const rgb=[new Float32Array(n),new Float32Array(n),new Float32Array(n)],p=new Float32Array(n);
    for(let i=0;i<n;i++){p[i]=mask[i*4+3]/255;for(let c=0;c<3;c++)rgb[c][i]=pixels.data[i*4+c]/255;}
    const mu=rgb.map(mean),mp=mean(p),cov=[],cross=[];
    for(let c=0;c<3;c++){
      const v=new Float32Array(n);for(let i=0;i<n;i++)v[i]=rgb[c][i]*p[i];
      const m=mean(v);for(let i=0;i<n;i++)m[i]-=mu[c][i]*mp[i];cross.push(m);
      for(let d=c;d<3;d++){
        for(let i=0;i<n;i++)v[i]=rgb[c][i]*rgb[d][i];const a=mean(v);
        for(let i=0;i<n;i++)a[i]-=mu[c][i]*mu[d][i];cov.push(a);
      }
    }
    const coeff=[new Float32Array(n),new Float32Array(n),new Float32Array(n)],bias=new Float32Array(n);
    for(let i=0;i<n;i++){
      const a=cov[0][i]+.001,b=cov[1][i],c=cov[2][i],d=cov[3][i]+.001,e=cov[4][i],f=cov[5][i]+.001;
      const A=d*f-e*e,B=c*e-b*f,C=b*e-c*d,D=a*f-c*c,E=b*c-a*e,F=a*d-b*b;
      const det=Math.max(1e-12,a*A+b*B+c*C),u=cross[0][i],v=cross[1][i],z=cross[2][i];
      coeff[0][i]=(A*u+B*v+C*z)/det;coeff[1][i]=(B*u+D*v+E*z)/det;coeff[2][i]=(C*u+E*v+F*z)/det;
      bias[i]=mp[i]-coeff[0][i]*mu[0][i]-coeff[1][i]*mu[1][i]-coeff[2][i]*mu[2][i];
    }
    const filtered=coeff.map(mean),mb=mean(bias);
    for(let i=0;i<n;i++){
      const probability=mb[i]+filtered[0][i]*rgb[0][i]+filtered[1][i]*rgb[1][i]+filtered[2][i]*rgb[2][i];
      const alpha=clamp((probability-.40)/.36);
      mask[i*4+3]=Math.round(alpha*alpha*(3-2*alpha)*255);
    }
    return mask;
  }
  async function analyze(image){
    const scale=Math.min(1,900/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    const input=document.createElement('canvas');input.width=input.height=768;const ic=input.getContext('2d');
    const ratio=768/Math.max(canvas.width,canvas.height),w=Math.round(canvas.width*ratio),h=Math.round(canvas.height*ratio),dx=Math.floor((768-w)/2),dy=Math.floor((768-h)/2);
    ic.fillStyle='#727272';ic.fillRect(0,0,768,768);ic.drawImage(canvas,dx,dy,w,h);
    const bytes=ic.getImageData(0,0,768,768).data,tensor=new Float32Array(3*768*768),plane=768*768;
    for(let i=0;i<plane;i++)for(let c=0;c<3;c++)tensor[c*plane+i]=bytes[i*4+c]/255;
    const result=await inference(tensor);
    if(!result.count)throw Error('NO_NAILS');
    const tiny=document.createElement('canvas');tiny.width=result.width;tiny.height=result.height;const tc=tiny.getContext('2d');
    const maskData=tc.createImageData(tiny.width,tiny.height),alpha=new Uint8ClampedArray(result.mask);
    for(let i=0;i<alpha.length;i++){maskData.data[i*4]=maskData.data[i*4+1]=maskData.data[i*4+2]=255;maskData.data[i*4+3]=alpha[i];}
    tc.putImageData(maskData,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(tiny,dx/4,dy/4,w/4,h/4,0,0,canvas.width,canvas.height);
    const mask=refineNailMask(pixels,ctx.getImageData(0,0,canvas.width,canvas.height).data);
    let total=0,count=0;
    for(let i=0;i<mask.length;i+=4)if(mask[i+3]>180){total+=pixels.data[i]*.2126+pixels.data[i+1]*.7152+pixels.data[i+2]*.0722;count++;}
    if(count<40)throw Error('NO_NAILS');
    return {pixels,mask,mean:total/count};
  }
  async function load(url,key){
    const ticket=++serial;source={url,key};active=null;original=false;busy(true);$('nailResult').hidden=true;$('nailRetry').hidden=true;
    $('nailCompare').setAttribute('aria-pressed','false');$('nailCompare').textContent='Ver original';
    message('Identificando as unhas. Na primeira vez, o carregamento da IA pode levar alguns segundos.');
    try{
      const image=new Image();image.src=url;await image.decode();if(ticket!==serial)return;
      $('nailOriginal').src=url;$('nailOriginal').alt=mode==='model'?'Mão modelo para simulação de esmalte':'Sua mão para simulação de esmalte';
      let data=cache.get(key);if(!data){data=await analyze(image);if(ticket!==serial)return;cache.set(key,data);}
      active=data;render(hex,intensity);busy(false);message('Prévia pronta. Compare com a foto original e escolha sua cor.');
    }catch(e){if(ticket!==serial)return;if(e.message!=='NO_NAILS')resetWorker(e);active=null;busy(false);$('nailRetry').hidden=false;message(e.message==='NO_NAILS'?'Não consegui identificar as unhas. Tente uma foto mais próxima, com as unhas voltadas para a câmera.':'Não foi possível carregar a simulação. Confira sua conexão e tente novamente.',true);console.warn('Nail simulation:',e);}
  }
  async function setMode(next){
    started=true;mode=next;uploadSerial++;const ticket=++serial;
    $('nailModelTab').classList.toggle('active',mode==='model');$('nailModelTab').setAttribute('aria-pressed',mode==='model');
    $('nailUploadTab').classList.toggle('active',mode==='upload');$('nailUploadTab').setAttribute('aria-pressed',mode==='upload');
    $('nailModels').hidden=mode!=='model';$('nailReplace').hidden=mode!=='upload'||!uploaded;
    $('nailUploadPrompt').hidden=mode!=='upload'||!!uploaded;
    if(mode==='upload'){
      if(uploaded)return load(uploaded.url,uploaded.key);
      active=null;source=null;busy(false);$('nailResult').hidden=true;$('nailRetry').hidden=true;message('Envie uma foto da sua mão para experimentar.');return;
    }
    active=null;busy(true);$('nailResult').hidden=true;
    try{const url=await modelSource(model);if(ticket===serial)return load(url,model);}catch(e){if(ticket===serial){busy(false);message('Não foi possível abrir a foto modelo. Tente novamente.',true);$('nailRetry').hidden=false;}}
  }
  async function upload(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){message('Escolha uma imagem JPG, PNG ou WebP.',true);return;}
    if(file.size>20*1024*1024){message('Escolha uma foto de até 20 MB.',true);return;}
    const ticket=++uploadSerial,url=URL.createObjectURL(file),image=new Image();image.src=url;
    try{await image.decode();if(ticket!==uploadSerial){URL.revokeObjectURL(url);return;}
      if(image.naturalWidth<100||image.naturalHeight<100)throw Error('small');
      if(uploaded){cache.delete(uploaded.key);URL.revokeObjectURL(uploaded.url);}
      uploaded={url,key:'upload-'+ticket};return setMode('upload');
    }catch(e){URL.revokeObjectURL(url);if(ticket===uploadSerial)message('Não consegui abrir essa foto. Escolha uma imagem com boa resolução.',true);}
  }
  function render(color=hex,strength=intensity){
    hex=color;intensity=strength;cancelAnimationFrame(frame);if(!active)return;
    frame=requestAnimationFrame(()=>{
      if(!active)return;const {pixels,mask,mean}=active;
      const output=new ImageData(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height),rgb=hex.match(/[a-f\d]{2}/gi).map(c=>parseInt(c,16));
      for(let i=0;i<output.data.length;i+=4){if(!mask[i+3])continue;
        const lum=pixels.data[i]*.2126+pixels.data[i+1]*.7152+pixels.data[i+2]*.0722;
        const shade=Math.max(.25,Math.min(1.6,lum/Math.max(35,mean))),shine=Math.max(0,lum-mean*1.25)*.7;
        const a=mask[i+3]/255*intensity;
        for(let c=0;c<3;c++)output.data[i+c]=pixels.data[i+c]*(1-a)+Math.min(255,rgb[c]*shade+shine)*a;
      }
      const canvas=$('nailResult');canvas.width=pixels.width;canvas.height=pixels.height;canvas.getContext('2d').putImageData(output,0,0);canvas.hidden=original;
    });
  }
  function toggleOriginal(){original=!original;$('nailResult').hidden=original||!active;$('nailCompare').setAttribute('aria-pressed',original);$('nailCompare').textContent=original?'Ver simulação':'Ver original';}
  function selectModel(key){model=key;document.querySelectorAll('[data-nail-model]').forEach(b=>{b.classList.toggle('active',b.dataset.nailModel===key);b.setAttribute('aria-pressed',b.dataset.nailModel===key);});return setMode('model');}
  function download(){if(!active)return;const a=document.createElement('a');a.download='minhas-unhas-isis-avelar.png';a.href=$('nailResult').toDataURL();a.click();}
  return {setMode,selectModel,upload,render,toggleOriginal,download,retry:()=>source?load(source.url,source.key):setMode(mode),start:()=>{if(!started)setMode(mode);}};
})();
