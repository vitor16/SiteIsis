(() => {
  const track=document.getElementById('portfolioTrack');
  const slides=[...track.children], select=document.getElementById('portfolioSelect');
  let index=0, raf;
  function update(next) {
    index=next;select.value=String(index);
    document.getElementById('portfolioCounter').textContent=`${String(index+1).padStart(2,'0')} / ${slides.length}`;
    slides.forEach((slide,i)=>{slide.inert=i!==index;slide.setAttribute('aria-hidden',i!==index);});
  }
  function go(next) {
    const i=(next+slides.length)%slides.length;
    track.scrollTo({left:slides[i].offsetLeft,behavior:Math.abs(i-index)>1||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    update(i);
  }
  document.getElementById('portfolioPrev').onclick=()=>go(index-1);
  document.getElementById('portfolioNext').onclick=()=>go(index+1);
  select.onchange=()=>go(Number(select.value));
  track.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(index+(e.key==='ArrowRight'?1:-1));}});
  track.addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
    const nearest=slides.reduce((best,slide,i)=>Math.abs(slide.offsetLeft-track.scrollLeft)<Math.abs(slides[best].offsetLeft-track.scrollLeft)?i:best,0);
    update(nearest);
  });},{passive:true});
  let width=track.clientWidth;
  new ResizeObserver(()=>{if(track.clientWidth!==width){width=track.clientWidth;track.scrollTo({left:slides[index].offsetLeft,behavior:'instant'});}}).observe(track);
  update(0);
})();
