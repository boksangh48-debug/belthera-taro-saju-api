(function(){
  const GPT_URL = "/"; // 기본 홈 또는 외부 목표로 바꿀 수 있음
  const KMONG_URL = "https://kmong.com/gig/646792";
  const EXPERT_URL = "https://m.expert.naver.com/expert/profile/home?storeId=100055123";
  const openBtn = document.getElementById("btn-open-gpt");
  const newtabBtn = document.getElementById("btn-newtab");
  const copyBtn = document.getElementById("btn-copy");
  const iosBtn = document.getElementById("btn-ios");
  const kmongBtn = document.getElementById("btn-kmong");
  const expertBtn = document.getElementById("btn-expert");
  if(openBtn){ openBtn.addEventListener("click", ()=>{ window.location.href = GPT_URL; }); }
  if(newtabBtn){ newtabBtn.href = GPT_URL; newtabBtn.target = "_blank"; newtabBtn.rel="noopener"; }
  if(copyBtn){ copyBtn.addEventListener("click", async ()=>{
    try{ await navigator.clipboard.writeText(window.location.origin + "/"); copyBtn.textContent="복사됨"; setTimeout(()=>copyBtn.textContent="링크 복사",1200); }
    catch(e){ alert("복사 실패: 수동으로 복사해 주세요."); }
  });}
  if(iosBtn){
    iosBtn.addEventListener("click", ()=>{
      const tpl = document.getElementById("tpl-ios"); if(!tpl) return;
      const node = tpl.content.cloneNode(true); document.body.appendChild(node);
      const close = document.getElementById("btn-close"); close && close.addEventListener("click", ()=>{
        const sheets = document.getElementsByClassName("sheet"); if(sheets.length) sheets[0].remove();
      });
    });
  }
  if(kmongBtn){ kmongBtn.href = KMONG_URL; kmongBtn.target="_blank"; kmongBtn.rel="noopener"; }
  if(expertBtn){ expertBtn.href = EXPERT_URL; expertBtn.target="_blank"; expertBtn.rel="noopener"; }
})();