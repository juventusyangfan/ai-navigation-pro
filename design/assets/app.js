/* 智用笔记 · 原型共享交互逻辑（localStorage 模拟，正式版接 Supabase Auth） */
(function(){
  const KEY_USER='ea_user', KEY_FAV='ea_favs', KEY_NOTE='ea_notes', KEY_FB='ea_fb',
        KEY_USEFUL='ea_useful', KEY_COLLECT='ea_collect';
  const $= (s,r=document)=>r.querySelector(s);
  const $$= (s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function lsGet(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

  const EA={};
  EA.user=()=>lsGet(KEY_USER,null);
  EA.isLogin=()=>!!EA.user();
  EA.login=(name,role)=>{lsSet(KEY_USER,{name,role,ts:Date.now()});EA.renderUser();EA.toast('欢迎，'+name);};
  EA.logout=()=>{localStorage.removeItem(KEY_USER);EA.renderUser();EA.toast('已退出登录');};

  EA.favs=()=>lsGet(KEY_FAV,[]);
  EA.isFav=s=>EA.favs().includes(s);
  EA.toggleFav=s=>{let f=EA.favs();f=f.includes(s)?f.filter(x=>x!==s):[...f,s];lsSet(KEY_FAV,f);EA.renderFavs();EA.renderStats();return EA.isFav(s);};

  EA.note=s=>lsGet(KEY_NOTE,{})[s]||'';
  EA.saveNote=(s,t)=>{const n=lsGet(KEY_NOTE,{});n[s]=t;lsSet(KEY_NOTE,n);EA.renderStats();};

  EA.fb=()=>lsGet(KEY_FB,[]);
  EA.addFb=(tool,type,text)=>{const a=EA.fb();a.push({tool,type,text,ts:Date.now()});lsSet(KEY_FB,a);EA.renderStats();return a.length;};
  EA.fbCount=tool=>EA.fb().filter(f=>f.tool===tool).length;

  EA.useful=()=>lsGet(KEY_USEFUL,{});
  EA.collect=()=>lsGet(KEY_COLLECT,{});
  EA.toggleUseful=k=>{const u=EA.useful();u[k]=!u[k];lsSet(KEY_USEFUL,u);return u[k];};
  EA.toggleCollect=k=>{const c=EA.collect();c[k]=!c[k];lsSet(KEY_COLLECT,c);return c[k];};

  EA.copy=function(text){
    const done=()=>EA.toast('已复制 ✓');
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done).catch(()=>fallback(text,done));
    } else fallback(text,done);
  };
  function fallback(text,done){
    const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){EA.toast('复制失败');}document.body.removeChild(ta);
  }

  EA.toast=function(msg){
    let t=$('#ea-toast');if(!t){t=document.createElement('div');t.id='ea-toast';t.className='toast';document.body.appendChild(t);}
    t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1800);
  };

  /* login modal */
  EA.openLogin=()=>{$('#ea-login')&&$('#ea-login').classList.add('open');};
  EA.closeLogin=()=>{$('#ea-login')&&$('#ea-login').classList.remove('open');};
  /* feedback modal */
  EA.openFb=()=>{$('#ea-fb')&&$('#ea-fb').classList.add('open');};
  EA.closeFb=()=>{$('#ea-fb')&&$('#ea-fb').classList.remove('open');};

  EA.renderUser=function(){
    const box=$('#ea-userbox');if(!box)return;const u=EA.user();
    if(u){
      box.innerHTML='<div class="user-menu" id="ea-umenu"><div class="avatar">'+esc((u.name||'U')[0])+'</div><span>'+esc(u.name)+'</span> ▾</div>'+
        '<div class="user-drop" id="ea-udrop"><a href="profile.html">个人中心</a><button id="ea-logout">退出登录</button></div>';
      $('#ea-umenu').onclick=e=>{e.stopPropagation();$('#ea-udrop').classList.toggle('open');};
      $('#ea-logout').onclick=()=>EA.logout();
      document.addEventListener('click',()=>{const d=$('#ea-udrop');if(d)d.classList.remove('open');});
    } else {
      box.innerHTML='<button class="btn btn-primary btn-sm" id="ea-loginbtn">登录</button>';
      $('#ea-loginbtn').onclick=EA.openLogin;
    }
    EA.renderStats();
  };
  EA.renderStats=function(){
    const u=EA.user();const set=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n;};
    if(!u)return;set('st-fav',EA.favs().length);set('st-note',Object.keys(lsGet(KEY_NOTE,{})).length);set('st-fb',EA.fb().length);
    const fc=$('#ea-fb-count');if(fc&&document.body.dataset.page==='tool')fc.textContent=EA.fbCount(document.body.dataset.slug)+' 条反馈';
  };
  EA.renderFavs=function(){$$('.fav-btn').forEach(b=>{EA.isFav(b.dataset.slug)?b.classList.add('on'):b.classList.remove('on');});};

  EA.wireFavs=function(){$$('.fav-btn').forEach(b=>{b.onclick=()=>{if(!EA.isLogin()){EA.toast('请先登录');EA.openLogin();return;}EA.toggleFav(b.dataset.slug);};});};
  EA.wireCopy=function(){$$('.copy-btn').forEach(b=>{b.onclick=()=>{const pb=b.closest('.prompt-box');EA.copy(pb?pb.innerText:'');};});};
  EA.wireSocial=function(){
    $$('.sp-btn').forEach(b=>{
      const kind=b.dataset.kind,key=b.dataset.key,base=+b.dataset.base||0;
      const map=kind==='useful'?EA.useful():EA.collect();
      if(map[key])b.classList.add('on');
      const num=b.querySelector('b');if(num)num.textContent=base+(map[key]?1:0);
      b.onclick=()=>{
        if(!EA.isLogin()){EA.toast('请先登录');EA.openLogin();return;}
        const v=(kind==='useful'?EA.toggleUseful:EA.toggleCollect)(key);
        b.classList.toggle('on',v);if(num)num.textContent=base+(v?1:0);
      };
    });
  };
  EA.wireLogin=function(){
    const ov=$('#ea-login');if(!ov)return;
    const form=$('#ea-login-form');
    if(form)form.onsubmit=e=>{e.preventDefault();const n=$('#ea-name').value.trim();const r=$('#ea-role').value;if(!n){EA.toast('请输入昵称');return;}EA.login(n,r);EA.closeLogin();};
    $('.modal-close',ov)&&$('.modal-close',ov).addEventListener('click',EA.closeLogin);
    ov.addEventListener('click',e=>{if(e.target===ov)EA.closeLogin();});
  };
  EA.wireFbModal=function(){
    const ov=$('#ea-fb');if(!ov)return;
    $('.modal-close',ov)&&$('.modal-close',ov).addEventListener('click',EA.closeFb);
    ov.addEventListener('click',e=>{if(e.target===ov)EA.closeFb();});
    const form=$('#ea-fb-form');
    if(form)form.onsubmit=e=>{
      e.preventDefault();const tool=$('#ea-fb-tool').value;const type=$('#ea-fb-type').value;const text=$('#ea-fb-text').value.trim();
      if(!text){EA.toast('请填写内容');return;}EA.addFb(tool,type,text);$('#ea-fb-text').value='';EA.closeFb();EA.toast('感谢反馈！');
    };
  };

  /* 全部场景页：角色切换过滤（左侧分类导航高亮由滚动监听处理） */
  EA.wireSceneRole=function(){
    const tabs=$$('.role-tabs button');if(!tabs.length)return;
    const cards=$$('.scene-card[data-roles]');
    tabs.forEach(t=>t.onclick=()=>{
      tabs.forEach(x=>x.classList.remove('active'));t.classList.add('active');
      const role=t.dataset.role;
      cards.forEach(c=>{const roles=(c.dataset.roles||'').split(',');c.style.display=(role==='all'||roles.includes(role))?'':'none';});
    });
  };

  EA.initToolPage=function(slug){
    const ta=document.getElementById('ea-note');
    if(ta){ta.value=EA.note(slug);ta.addEventListener('input',()=>EA.saveNote(slug,ta.value));}
    $$('[data-fb-tool]').forEach(b=>b.onclick=()=>{if(!EA.isLogin()){EA.toast('请先登录');EA.openLogin();return;}document.getElementById('ea-fb-tool').value=b.dataset.fbTool;EA.openFb();});
    const cnt=document.getElementById('ea-fb-count');if(cnt)cnt.textContent=EA.fbCount(slug)+' 条反馈';
  };

  EA.initPage=function(){
    EA.renderUser();
    EA.wireFavs();EA.wireCopy();EA.wireSocial();EA.wireLogin();EA.wireFbModal();EA.wireSceneRole();
    const page=document.body.dataset.page;
    if(page==='tool')EA.initToolPage(document.body.dataset.slug);
  };

  document.addEventListener('DOMContentLoaded',EA.initPage);
  window.EA=EA;
})();
