const data = window.OPPORTUNITY_DATA || [];
const analytics = window.ANALYTICS_DATA || {trendingTopics:[],activeCommunities:[]};
const state = {
  selected:data[0]?.id, platform:"All", topic:"All", tab:"why",
  feedback:JSON.parse(localStorage.getItem("engageiq-feedback") || localStorage.getItem("engagaeiq-feedback") || "{}"),
  interests:JSON.parse(localStorage.getItem("engageiq-interests") || localStorage.getItem("engagaeiq-interests") || "[]"),
  bandit:JSON.parse(localStorage.getItem("engageiq-bandit") || localStorage.getItem("engagaeiq-bandit") || '{"weights":[0,0,0,0],"interactions":0}'),
  restartArmed:false
};
const $ = s => document.querySelector(s);
const fmt = n => n >= 1000 ? `${Math.round(n/100)/10}K` : n;
const toast = msg => { $("#toast").textContent=msg; $("#toast").classList.add("show"); setTimeout(()=>$("#toast").classList.remove("show"),2200); };
const feedbackLabel = {engage:"✓ Engaged", skip:"× Skip", bookmark:"◇ Bookmark"};

function interestMatch(x){
  if(!state.interests.length) return 0;
  const haystack=`${x.topic} ${x.name} ${x.summary} ${x.actions.map(a=>a.title+" "+a.body).join(" ")}`.toLowerCase();
  return state.interests.filter(i=>haystack.includes(i.toLowerCase())).length;
}
function banditFeatures(x){return [interestMatch(x)>0?1:0,x.health/100,x.visibility/100,(x.trend||0)/50];}
function banditBoost(x){return banditFeatures(x).reduce((sum,v,i)=>sum+v*(state.bandit.weights[i]||0),0)*8;}
function personalizedScore(x){return Math.max(1,Math.min(100,Math.round(x.score+interestMatch(x)*3+banditBoost(x))));}
function trainBandit(x,reward){
  const features=banditFeatures(x), prediction=features.reduce((sum,v,i)=>sum+v*(state.bandit.weights[i]||0),0), rate=.08;
  state.bandit.weights=features.map((v,i)=>Math.max(-1,Math.min(1,(state.bandit.weights[i]||0)+rate*(reward-prediction)*v)));
  state.bandit.interactions+=1;localStorage.setItem("engageiq-bandit",JSON.stringify(state.bandit));
}
function filtered(){
  return data
    .filter(x => (state.platform==="All" || x.platform===state.platform) && (state.topic==="All" || x.topic===state.topic))
    .sort((a,b)=>personalizedScore(b)-personalizedScore(a));
}
function renderList(){
  $("#opportunityList").innerHTML = filtered().map((x,index)=>`
    <article class="opp ${x.id===state.selected?"selected":""}" data-id="${x.id}">
      <div class="rank">#${(index+1).toString().padStart(2,"0")}</div>
      <div class="opp-main">
        <div class="opp-top"><span class="platform ${x.platform}">${x.platform.toUpperCase()}</span><span class="topic">${x.topic}</span>${interestMatch(x)?`<span class="match-badge">${interestMatch(x)} interest match${interestMatch(x)>1?"es":""}</span>`:""}<span class="trend">↑ ${x.trend}%</span></div>
        <h3>${x.name}</h3><p>${x.summary}</p>
      </div>
      <div class="score-ring" style="--score:${personalizedScore(x)}"><span>${personalizedScore(x)}</span></div>
    </article>`).join("") || `<div style="padding:40px;text-align:center;color:var(--muted);font-size:11px">No opportunities match these filters.</div>`;
  document.querySelectorAll(".opp").forEach(el=>el.onclick=()=>{state.selected=el.dataset.id;renderList();renderDetail();});
}
function renderDetail(){
  const x=data.find(o=>o.id===state.selected) || filtered()[0] || data[0];
  if(!x) return;
  state.selected=x.id;
  const feedback=state.feedback[x.id];
  const score=personalizedScore(x);
  const matches=state.interests.filter(i=>`${x.topic} ${x.name} ${x.summary}`.toLowerCase().includes(i.toLowerCase()));
  $("#detailPanel").innerHTML=`
    <div class="detail-head">
      <div class="detail-meta"><span class="platform ${x.platform}">${x.platform.toUpperCase()}</span><span class="topic">${x.topic} · ↑ ${x.trend}% this week</span></div>
      <h2>${x.name}</h2><p>${x.summary}</p>
      <div class="detail-score"><strong>${score}</strong><span>PERSONALIZED MATCH SCORE<br>TOP ${Math.max(1,100-score)}% OF OPPORTUNITIES</span></div>
    </div>
    <div class="detail-body">
      <div class="tabs"><button class="tab ${state.tab==="why"?"active":""}" data-tab="why">WHY THIS?</button><button class="tab ${state.tab==="actions"?"active":""}" data-tab="actions">SUGGESTED ACTIONS (${x.actions.length})</button></div>
      ${state.tab==="why"?whyTemplate(x):actionsTemplate(x)}
    </div>
    <div class="feedback-row">${["engage","skip","bookmark"].map(f=>`<button class="feedback ${feedback===f?"active":""}" data-feedback="${f}">${feedbackLabel[f]}</button>`).join("")}</div>`;
  document.querySelectorAll(".tab").forEach(el=>el.onclick=()=>{state.tab=el.dataset.tab;renderDetail();});
  document.querySelectorAll(".feedback").forEach(el=>el.onclick=()=>setFeedback(x.id,el.dataset.feedback));
  document.querySelectorAll(".action-button").forEach(el=>el.onclick=()=>{setFeedback(x.id,"engage");toast("Action added to your weekly plan");});
}
function whyTemplate(x){
  const matched=state.interests.filter(i=>`${x.topic} ${x.name} ${x.summary}`.toLowerCase().includes(i.toLowerCase()));
  const learned=state.bandit.interactions?` Feedback learner adjustment: ${banditBoost(x)>=0?"+":""}${banditBoost(x).toFixed(1)} points from ${state.bandit.interactions} interaction${state.bandit.interactions===1?"":"s"}.`:"";
  const personal=(matched.length?`Matches your stated interests: ${matched.join(", ")}. This adds a ${matched.length*3}-point interest boost.`:"Add interests to let EngageIQ explain and improve this match.")+learned;
  return `<div class="explain-list"><div class="explain personal-explain"><b>◎</b><span>${personal}</span></div>${x.why.map((w,i)=>`<div class="explain"><b>${i+1}</b><span>${w}</span></div>`).join("")}</div>
  <div class="factor">${[["Interest relevance",Math.min(100,x.relevance+interestMatch(x)*5)],["Community health",x.health],["Visibility potential",x.visibility]].map(v=>`<div class="factor-row"><span>${v[0]}</span><div class="bar"><i style="width:${v[1]}%"></i></div><b>${v[1]}</b></div>`).join("")}<div class="factor-row"><span>Effort to engage</span><div class="bar"><i style="width:${x.effort==="Low"?25:x.effort==="Medium"?55:82}%"></i></div><b>${x.effort[0]}</b></div></div>`}
function actionsTemplate(x){const context=state.interests.length?`Tailored using: ${state.interests.join(", ")}`:"Add interests to further tailor these ideas.";return `<p class="eyebrow">✦ LLM-SUGGESTED · ${context}</p>${x.actions.map(a=>`<div class="suggestion"><div class="suggestion-top"><b>${a.title}</b><em>${a.type}</em></div><p>${a.body}</p><small>${a.impact}</small><button class="action-button">Add to engagement plan</button></div>`).join("")}`;}
function selectNextOpportunity(currentId){
  const options=filtered();
  if(!options.length) return;
  const currentIndex=options.findIndex(x=>x.id===currentId);
  const next=options[(currentIndex+1+options.length)%options.length] || options[0];
  state.selected=next.id;
}
function setFeedback(id,value){const x=data.find(o=>o.id===id);const next=state.feedback[id]===value?null:value;state.feedback[id]=next;if(next&&x){trainBandit(x,{engage:1,bookmark:.6,skip:-1}[next]);selectNextOpportunity(id);}localStorage.setItem("engageiq-feedback",JSON.stringify(state.feedback));renderList();renderDetail();renderMetrics();toast(next?`${feedbackLabel[value].replace(/[✓×◇] /,"")} saved · ranking learner updated`:"Feedback cleared");}
function renderMetrics(){
  const active=Object.values(state.feedback).filter(x=>x==="engage"||x==="bookmark").length;
  const highMatch=data.filter(x=>x.score>=80).length;
  const reach=data.reduce((sum,x)=>sum+x.audience,0);
  const momentum=Math.round(data.reduce((sum,x)=>sum+x.trend,0)/Math.max(data.length,1));
  $("#highMatchMetric").textContent=highMatch;
  $("#reachMetric").textContent=fmt(reach);
  $("#momentumMetric").textContent=`+${momentum}%`;
  $("#actionMetric").textContent=active;
}
function renderCharts(){
  const totals=[0,0,0,0,0,0,0];data.forEach(x=>x.activity.forEach((v,i)=>totals[i]+=v)); const max=Math.max(...totals), w=600,h=135,p=12; const pts=totals.map((v,i)=>`${p+i*(w-2*p)/6},${h-p-v/max*(h-2*p)}`).join(" ");
  $("#volumeChart").innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#14956b" stop-opacity=".25"/><stop offset="100%" stop-color="#14956b" stop-opacity="0"/></linearGradient></defs>${[30,65,100].map(y=>`<line class="axis" x1="0" y1="${y}" x2="${w}" y2="${y}"/>`).join("")}<polygon class="area" points="${p},${h-p} ${pts} ${w-p},${h-p}"/><polyline class="line" points="${pts}"/>${totals.map((v,i)=>`<circle class="dot" cx="${p+i*(w-2*p)/6}" cy="${h-p-v/max*(h-2*p)}" r="3"/><text class="label" x="${p+i*(w-2*p)/6}" y="${h}" text-anchor="middle">${["M","T","W","T","F","S","S"][i]}</text>`).join("")}</svg>`;
  const counts={};data.forEach(x=>counts[x.topic]=(counts[x.topic]||0)+1); const colors=["#006c4c","#5f9e83","#a5cbb9","#d5f25b","#8a928d"]; const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]); let pos=0; const stops=entries.map((e,i)=>{let start=pos;pos+=e[1]/data.length*100;return `${colors[i%colors.length]} ${start}% ${pos}%`}).join(",");
  $("#topicChart").innerHTML=`<div class="donut" style="background:conic-gradient(${stops})"></div><div class="legend">${entries.map((e,i)=>`<div><span><i style="background:${colors[i%colors.length]}"></i>${e[0]}</span><b>${Math.round(e[1]/data.length*100)}%</b></div>`).join("")}</div>`;
  $("#trendingTopics").innerHTML=analytics.trendingTopics.slice(0,15).map((x,i)=>`<div class="analytics-row"><span class="table-rank">${String(i+1).padStart(2,"0")}</span><strong>${x[0]}</strong><span>${fmt(x[1])} engagements</span><b>↑ ${x[2]}%</b></div>`).join("");
  $("#growthList").innerHTML=analytics.activeCommunities.slice(0,15).map((x,i)=>`<div class="analytics-row"><span class="table-rank">${String(i+1).padStart(2,"0")}</span><strong>${x[0]}</strong><span class="platform ${x[1]}">${x[1].toUpperCase()}</span><span>${fmt(x[2])} engagements</span><b>↑ ${x[3]}%</b></div>`).join("");
}
function downloadCSV(){
  const rows=[["Rank","Platform","Opportunity","Topic","Match Score","Weekly Growth","Audience","Feedback","Top Suggested Action"],...data.map(x=>[x.rank,x.platform,x.name,x.topic,x.score,`${x.trend}%`,x.audience,state.feedback[x.id]||"",x.actions[0].title])];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"); const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="weekly-engagement-brief.csv";a.click();URL.revokeObjectURL(a.href);toast("Weekly brief downloaded");
}
function selectFirstFiltered(){const first=filtered()[0];if(first){state.selected=first.id;renderDetail();}}
function renderInterests(){
  $("#interestChips").innerHTML=state.interests.length?state.interests.map(i=>`<button type="button" class="interest-chip" data-interest="${i}">${i}<span>×</span></button>`).join(""):`<span class="empty-interests">No interests added yet</span>`;
  document.querySelectorAll(".interest-chip").forEach(el=>el.onclick=()=>{state.interests=state.interests.filter(i=>i!==el.dataset.interest);saveInterests();});
}
function saveInterests(){localStorage.setItem("engageiq-interests",JSON.stringify(state.interests));renderInterests();selectFirstFiltered();renderList();renderDetail();toast("Recommendations reranked using your interests");}
$("#interestForm").onsubmit=e=>{e.preventDefault();const values=$("#interestInput").value.split(",").map(x=>x.trim()).filter(Boolean);state.interests=[...new Set([...state.interests,...values])].slice(0,12);$("#interestInput").value="";saveInterests();};
$("#restartButton").onclick=()=>{if(!state.restartArmed){state.restartArmed=true;$("#restartButton").textContent="Click again to confirm reset";setTimeout(()=>{state.restartArmed=false;$("#restartButton").textContent="↻ Restart & forget memory";},3500);return;}localStorage.removeItem("engageiq-feedback");localStorage.removeItem("engageiq-interests");localStorage.removeItem("engageiq-bandit");localStorage.removeItem("engagaeiq-feedback");localStorage.removeItem("engagaeiq-interests");localStorage.removeItem("engagaeiq-bandit");localStorage.removeItem("engage-feedback");state.feedback={};state.interests=[];state.bandit={weights:[0,0,0,0],interactions:0};state.platform="All";state.topic="All";state.selected=data[0]?.id;state.restartArmed=false;$("#restartButton").textContent="↻ Restart & forget memory";$("#topicFilter").value="All";document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x.dataset.filter==="All"));renderInterests();renderList();renderDetail();renderMetrics();toast("Memory and learned ranking preferences cleared.");};
document.querySelectorAll(".filter").forEach(el=>el.onclick=()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));el.classList.add("active");state.platform=el.dataset.filter;selectFirstFiltered();renderList();});
const topics=[...new Set(data.map(x=>x.topic))];$("#topicFilter").innerHTML+=topics.map(t=>`<option>${t}</option>`).join("");$("#topicFilter").onchange=e=>{state.topic=e.target.value;selectFirstFiltered();renderList();};
$("#csvButton").onclick=downloadCSV;$("#briefButton").onclick=downloadCSV;$("#printButton").onclick=()=>window.print();$("#themeButton").onclick=()=>document.body.classList.toggle("dark");$("#signalButton").onclick=()=>{state.topic="AI Agents";$("#topicFilter").value="AI Agents";selectFirstFiltered();location.hash="#opportunities";renderList();toast("Showing AI Agents opportunities");};
renderInterests();renderList();renderDetail();renderMetrics();renderCharts();
