(() => {
  const API_BASE = window.API_BASE || "https://story-director-v16.grijesh-s.workers.dev";
  const PROFILE_KEY = "sdv16_voice_profiles_v1";
  const VOICES = [
    ["alloy","Male / Natural — Alloy"],["echo","Male / Clear — Echo"],["fable","Male / Warm — Fable"],["ash","Male / Deep — Ash"],["sage","Male / Calm — Sage"],["verse","Male / Expressive — Verse"],
    ["nova","Female / Natural — Nova"],["shimmer","Female / Soft — Shimmer"],["coral","Female / Warm — Coral"],["ballad","Female / Rich — Ballad"],["marin","Female / Natural — Marin"],["cedar","Female / Warm — Cedar"],
    ["onyx","Narrator / Deep — Onyx"]
  ];
  const EMOTIONS = ["Natural","Emotional","Romantic","Suspenseful","Funny","Serious"];
  const MALE_NAMES = new Set("रवि राहुल अमित रोहित अजय विजय संजय मनोज राज राजेश राकेश सुरेश मुकेश आकाश आदित्य अंकित अभिषेक अभय अरुण वरुण दीपक पंकज नितिन विनय विकास विवेक मोहन सोहन करण अर्जुन रोहन अमन सुमित सुनील अनिल कमल प्रदीप प्रकाश दिनेश महेश रमेश राजीव देव मनीष मयंक नवीन सचिन आनंद आशीष शिव शिवम गोपाल फैसल फैज फैज़ इमरान सलमान आरिफ अली समीर ravi rahul amit rohit ajay vijay sanjay manoj raj rajesh rakesh suresh mukesh akash aditya ankit abhishek abhay arun varun deepak pankaj nitin vinay vikas vivek mohan sohan karan arjun rohan aman sumit sunil anil kamal pradeep prakash dinesh mahesh ramesh rajiv manish mayank naveen sachin anand ashish shiv shivam".split(/\s+/).map(s=>s.toLowerCase()));
  const FEMALE_NAMES = new Set("नेहा रीमा सीमा पूजा राधा रानी सोनिया सोनम निशा आशा कविता सुनीता गीता अनीता संगीता प्रिया रिया दिया मीरा मीना रेखा मधु शालिनी अंजली अंजलि स्वाति पायल पूनम लता सरिता वंदना मोना ज्योति आरती नंदिनी काजल तनु तन्वी साक्षी श्रुति रितु ऋतु निकिता ममता कमला गौरी मंजू रश्मि सुमन सरस्वती लक्ष्मी पार्वती राधिका सविता कुसुम चांदनी अमृता दीपा दीपिका करिश्मा श्रेया स्वरा कृति कृतिका आकांक्षा आराध्या सिमरन मेघा मेघना भूमि भावना मुस्कान खुशी पिंकी गुड़िया गुड्डी वर्षा रूपा रूपाली फरहा नाज़िया नाजिया शबाना फातिमा आयशा सना ज़ोया जोया नूर आलिया रुचि अदिति इशिता इरा अनु अनुष्का कंचन चंचल डॉली neha reema seema pooja radha rani sonia sonam nisha asha kavita sunita geeta anita sangeeta priya riya diya meera meena rekha madhu shalini anjali swati payal poonam lata sarita vandana mona jyoti aarti kajal tanu tanvi sakshi shruti ritu nikita mamta gauri manju rashmi suman lakshmi radhika savita kusum amrita deepa deepika karishma shreya swara kriti simran megha bhavna khushi noor zoya aliya ruchi aditi ishita ira anu anushka kanchan chanchal dolly".split(/\s+/).map(s=>s.toLowerCase()));

  const voiceEl = document.getElementById("voice");
  if (!voiceEl || document.getElementById("multiSpeakerVoice")) return;

  const originalVoiceText = document.getElementById("voiceText");
  const originalVoiceStatus = document.getElementById("voiceStatus");
  const originalAudioBox = document.getElementById("audioBox");
  const originalVoiceBtn = document.getElementById("voiceBtn");
  const originalBack = voiceEl.querySelector('button[onclick="go(\'director\')"]');
  const heading = voiceEl.querySelector("h2")?.outerHTML || "<h2>🎙️ Voice</h2>";

  const oldVoiceControls = voiceEl.querySelector(".grid");
  if (oldVoiceControls) oldVoiceControls.remove();
  if (originalVoiceText?.parentElement) originalVoiceText.parentElement.remove();
  voiceEl.querySelectorAll(".voice-actions").forEach(e => e.remove());
  if (originalVoiceStatus) originalVoiceStatus.remove();
  if (originalAudioBox) originalAudioBox.remove();

  voiceEl.insertAdjacentHTML("beforeend", `
    <div id="multiSpeakerVoice" class="msv-shell">
      <div class="msv-panel">
        <div class="msv-head">
          <div><h3>Multi-Speaker Voice</h3><p>Characters automatically appear here.</p></div>
          <button id="msvAdd" class="msv-add" type="button">＋ Add Speaker</button>
        </div>
        <div class="msv-note">💡 हर character की अपनी voice और emotion intensity होगी। Narrator अलग रहेगा।</div>
        <div class="msv-labels"><span>Speaker</span><span>Voice</span><span>Emotion Intensity</span></div>
        <div id="msvRows" class="msv-rows"></div>
        <div id="msvDuplicate" class="msv-duplicate hidden"></div>
      </div>
      <div class="field msv-text-field"><label>Text to speak</label><textarea id="msvText" placeholder="यहाँ story/script आएगा…"></textarea></div>
      <div class="voice-actions msv-actions">
        <button id="msvBack" class="btn secondary" type="button">‹ Back to Director</button>
        <button id="msvGenerate" class="btn" type="button">🎙️ Generate Multi-Speaker Voice</button>
      </div>
      <div id="msvStatus" class="status">Ready. Characters Director से automatically identify होंगे।</div>
      <div id="msvAudioBox" class="hidden" style="margin-top:10px"><audio id="msvAudio" controls style="width:100%"></audio><button id="msvDownload" class="btn secondary" style="margin-top:9px" type="button">⬇️ Download MP3</button></div>
    </div>
  `);

    const style = document.createElement("style");
  style.textContent = `
    /* ===== V16 MULTI-SPEAKER — COMPACT CHARACTER CARDS ===== */

    #voice .msv-shell{
      margin-top:4px;
    }

    #voice .msv-panel{
      background:linear-gradient(145deg,#0d0f18,#0a0c13);
      border:1px solid #30354c;
      border-radius:16px;
      padding:10px;
    }

    #voice .msv-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:8px;
    }

    #voice .msv-head h3{
      margin:0;
      font-size:18px;
      color:#f5f3fb;
    }

    #voice .msv-head p{
      margin:3px 0 0;
      color:#8f93a8;
      font-size:10px;
    }

    #voice .msv-add{
      flex:0 0 auto;
      min-height:34px;
      height:34px;
      padding:6px 10px;
      border-radius:10px;
      border:1px solid #3d4165;
      background:#171a2a;
      color:#f4f2fb;
      font-weight:700;
      font-size:11px;
    }

    #voice .msv-note{
      margin:8px 0 6px;
      color:#aeb0c4;
      font-size:10px;
      line-height:1.3;
    }

    #voice .msv-labels{
      display:grid;
      grid-template-columns:86px 1fr 112px;
      gap:5px;
      color:#8f93a8;
      font-size:8px;
      text-transform:uppercase;
      letter-spacing:.04em;
      padding:0 5px 4px;
    }

    /* CHARACTER CARD */
    #voice .msv-rows{
      display:grid;
      gap:3px;
      max-height:330px;
      overflow:auto;
      padding-right:1px;
      scrollbar-width:thin;
    }

    #voice .msv-row{
      display:grid;
      grid-template-columns:86px 1fr 112px;
      gap:5px;
      align-items:center;
      padding:2px;
      border:1px solid #272c3f;
      border-radius:9px;
      background:#0b0d15;
      min-height:0;
    }

    #voice .msv-speaker{
      min-width:0;
      display:flex;
      align-items:center;
      gap:5px;
    }

    #voice .msv-avatar{
      width:24px;
      height:24px;
      display:grid;
      place-items:center;
      border-radius:50%;
      background:#252a42;
      font-size:12px;
      flex:0 0 auto;
    }

    #voice .msv-name{
      min-width:0;
      font-size:9px;
      font-weight:750;
      line-height:1.05;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    #voice .msv-type{
      display:block;
      color:#8f93a8;
      font-size:7px;
      line-height:1;
      margin-top:1px;
    }

    /* VOICE SELECTOR */
    #voice .msv-voice{
      width:100%;
      min-width:0;
      min-height:27px;
      height:27px;
      border-radius:7px;
      font-size:8px;
      padding:4px 5px;
    }

    /* EMOTION — COMPACT */
    #voice .msv-emotion{
      display:grid;
      grid-template-columns:30px 1fr 28px;
      align-items:center;
      gap:3px;
      min-width:0;
    }

    #voice .msv-emotion output{
      font-size:8px;
      color:#d6c9ff;
      text-align:right;
    }

    #voice .msv-emotion input[type=range]{
      width:100%;
      height:12px;
      margin:0;
      accent-color:#8b5cf6;
    }

    #voice .msv-emotion-label{
      font-size:8px;
      color:#9ea2b6;
    }

    #voice .msv-remove{
      margin-left:auto;
      border:0;
      background:transparent;
      color:#777d91;
      font-size:15px;
      padding:1px 3px;
    }
    #voice .msv-row:first-child .msv-remove{
  display:none !important;
}

    #voice .msv-duplicate{
      margin-top:5px;
      padding:6px 8px;
      border:1px solid #5b4b31;
      background:#211a0d;
      border-radius:8px;
      color:#f1c77b;
      font-size:9px;
      line-height:1.3;
    }

    #voice .msv-text-field{
      margin-top:9px;
    }

    /* ACTION AREA */
    #voice .msv-actions{
      margin-top:7px;
      display:grid;
      gap:5px;
    }

    #voice .msv-actions .btn{
      min-height:36px;
      height:36px;
      padding:7px 8px;
      font-size:10px;
      line-height:1.1;
    }

    /* GENERATE BUTTON — FULL WIDTH, SAME POSITION */
    #voice .msv-actions #msvGenerate{
      width:100%;
      min-height:42px;
      height:42px;
      font-size:12px;
    }

    @media(max-width:560px){

      #voice .msv-panel{
        padding:8px;
        border-radius:13px;
      }

      #voice .msv-head h3{
        font-size:16px;
      }

      #voice .msv-head p{
        font-size:9px;
      }

      #voice .msv-add{
        min-height:31px;
        height:31px;
        padding:5px 8px;
        font-size:10px;
        border-radius:9px;
      }

      #voice .msv-note{
        font-size:9px;
        margin:7px 0 5px;
      }

      #voice .msv-labels{
        grid-template-columns:78px 1fr 104px;
        gap:4px;
        font-size:7px;
        padding:0 4px 3px;
      }

      #voice .msv-row{
        grid-template-columns:78px 1fr 104px;
        gap:4px;
        padding:4px;
        border-radius:8px;
      }

      #voice .msv-avatar{
        width:22px;
        height:22px;
        font-size:11px;
      }

      #voice .msv-name{
        font-size:8px;
      }

      #voice .msv-type{
        font-size:6.5px;
      }

      #voice .msv-voice{
        min-height:25px;
        height:25px;
        font-size:7.5px;
        padding:3px 4px;
        border-radius:6px;
      }

      #voice .msv-emotion{
        grid-template-columns:27px 1fr 25px;
        gap:2px;
      }

      #voice .msv-emotion-label,
      #voice .msv-emotion output{
        font-size:7px;
      }

      #voice .msv-emotion input[type=range]{
        height:11px;
      }

      #voice .msv-rows{
        gap:3px;
        max-height:300px;
      }

      #voice .msv-actions{
        margin-top:6px;
        gap:5px;
      }

      #voice .msv-actions .btn{
        min-height:34px;
        height:34px;
        font-size:10px;
        padding:6px;
      }

      #voice .msv-actions #msvGenerate{
        min-height:40px;
        height:40px;
        font-size:11px;
      }
    }
  `;
  document.head.appendChild(style);
  document.head.appendChild(style);

  const rowsEl = document.getElementById("msvRows");
  const textEl = document.getElementById("msvText");
  const statusEl = document.getElementById("msvStatus");
  const audioBox = document.getElementById("msvAudioBox");
  const audioEl = document.getElementById("msvAudio");
  const generateEl = document.getElementById("msvGenerate");
  const profiles = loadProfiles();
  let lastBlob = null;

  function normalize(s){return String(s||"").trim().toLowerCase().replace(/\s+/g," ");}
  function isNarrator(n){return ["वाचक","कथावाचक","सूत्रधार","नरेटर","narrator","narration","voiceover","voice over","v.o.","vo"].some(x=>normalize(x)===normalize(n));}
  function genderOf(n){const x=normalize(n);if(isNarrator(n))return "narration";if(FEMALE_NAMES.has(x)||/female|girl|woman|ladki|लड़की|महिला|औरत|स्त्री/.test(x))return "female";if(MALE_NAMES.has(x)||/male|boy|man|ladka|लड़का|पुरुष|आदमी/.test(x))return "male";return "character";}
  function defaultVoice(name, used){
    const g=genderOf(name);
    if(g==="narration") return "onyx";
    const pool=g==="female"?["nova","shimmer","coral","ballad","marin","cedar"]:["alloy","echo","fable","ash","sage","verse"];
    return pool.find(v=>!used.has(v))||pool[used.size%pool.length];
  }
  function avatar(g){return g==="narration"?"🎙️":g==="female"?"👩":g==="male"?"👨":"🎭";}
  function loadProfiles(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||"{}")}catch{return {}}}
  function saveProfiles(){try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profiles))}catch{}}
  function setStatus(msg,kind=""){statusEl.textContent=msg;statusEl.className="status "+kind;}
  function getText(){return textEl.value.trim() || document.getElementById("script")?.value.trim() || document.getElementById("voiceText")?.value.trim() || "";}
  function parseLines(text){
    const out=[];let speaker="वाचक",current="";
    String(text||"").replace(/\r/g,"").split("\n").forEach(raw=>{
      const line=raw.trim();if(!line)return;
      const m=line.match(/^([A-Za-z\u0900-\u097F][A-Za-z0-9\u0900-\u097F _-]{0,40})\s*(?::|[—–-])\s*(.*)$/u);
      if(m){if(current.trim())out.push({speaker,text:current.trim()});speaker=m[1].replace(/^\*+|\*+$/g,"").trim();current=m[2].trim();}
      else current=current?current+" "+line:line;
    });
    if(current.trim())out.push({speaker,text:current.trim()});
    return out;
  }
  function detectedSpeakers(text){
    const lines=parseLines(text);const names=[];const seen=new Set();
    lines.forEach(x=>{const key=normalize(x.speaker);if(!seen.has(key)){seen.add(key);names.push(x.speaker)}});
    if(!names.length)names.push("वाचक");
    return names;
  }
  function ensureProfiles(names){
    const used=new Set(Object.values(profiles).map(p=>p.voice).filter(Boolean));
    names.forEach(name=>{
      const key=normalize(name);if(!key)return;
      if(!profiles[key]){
        const g=genderOf(name);const v=defaultVoice(name,used);used.add(v);
        profiles[key]={name,voice:v,emotion:"Natural",intensity:g==="narration"?60:g==="female"?80:70};
      }else profiles[key].name=name;
    });
    saveProfiles();
  }
  function render(){
    const names=detectedSpeakers(getText());ensureProfiles(names);
    rowsEl.innerHTML=names.map(name=>{
      const key=normalize(name),p=profiles[key],g=genderOf(name);
      const options=VOICES.map(([v,label])=>`<option value="${v}" ${p.voice===v?"selected":""}>${label}</option>`).join("");
      const emos=EMOTIONS.map(e=>`<option value="${e}" ${p.emotion===e?"selected":""}>${e}</option>`).join("");
      return `<div class="msv-row" data-key="${esc(key)}">
        <div class="msv-speaker"><div class="msv-avatar">${avatar(g)}</div><div><div class="msv-name">${esc(p.name)}</div><span class="msv-type">${g==="narration"?"Narration":"Character"}</span></div></div>
        <select class="msv-voice" aria-label="Voice for ${esc(p.name)}">${options}</select>
        <div class="msv-emotion"><select class="msv-voice msv-emotion-select" aria-label="Emotion for ${esc(p.name)}">${emos}</select><input class="msv-range" type="range" min="0" max="100" value="${Number(p.intensity)||60}" aria-label="Emotion intensity for ${esc(p.name)}"><output>${Number(p.intensity)||60}%</output></div>
      </div>`;
    }).join("");
    rowsEl.querySelectorAll(".msv-row").forEach(row=>{
      const key=row.dataset.key,p=profiles[key];
      row.querySelector(".msv-voice").addEventListener("change",e=>{p.voice=e.target.value;saveProfiles();checkDuplicates()});
      row.querySelector(".msv-emotion-select").addEventListener("change",e=>{p.emotion=e.target.value;saveProfiles()});
      const range=row.querySelector(".msv-range"),out=row.querySelector("output");
      range.addEventListener("input",()=>{p.intensity=Number(range.value);out.value=p.intensity+"%";out.textContent=p.intensity+"%";saveProfiles()});
    });
    checkDuplicates();
  }
  function checkDuplicates(){
    const groups={};Object.values(profiles).forEach(p=>{if(!groups[p.voice])groups[p.voice]=[];groups[p.voice].push(p.name)});
    const dup=Object.values(groups).filter(a=>a.length>1);
    const el=document.getElementById("msvDuplicate");
    if(dup.length){el.classList.remove("hidden");el.textContent="⚠️ Same voice assigned: "+dup.map(a=>a.join(" + ")).join(" • ")+". आप किसी एक character की voice बदल सकते हैं।";}
    else {el.classList.add("hidden");el.textContent="";}
  }
  function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function syncText(){const t=document.getElementById("script")?.value||document.getElementById("voiceText")?.value||"";if(t && !textEl.value)textEl.value=t;render();}
  function chunk(text,max=3500){const s=String(text||"").trim();if(!s)return[];const parts=[];let cur="";for(const sentence of (s.match(/[^।!?！？]+[।!?！？]+|[^।!?！？]+$/gu)||[s])){const x=sentence.trim();if(!x)continue;if((cur+" "+x).trim().length<=max)cur=(cur+" "+x).trim();else{if(cur)parts.push(cur);if(x.length<=max)cur=x;else{let w="";for(const token of x.split(/\s+/)){if((w+" "+token).trim().length<=max)w=(w+" "+token).trim();else{if(w)parts.push(w);w=token}}cur=w}}}if(cur)parts.push(cur);return parts;}
  function groupedBatches(text){
    const lines=parseLines(text);if(!lines.length)return[];const groups=[];let cur=null;
    for(const l of lines){const key=normalize(l.speaker);if(!cur||cur.key!==key){cur={key,speaker:l.speaker,text:l.text};groups.push(cur)}else cur.text+=" "+l.text;}
    return groups.flatMap(g=>chunk(g.text).map(t=>({speaker:g.speaker,text:t})));
  }
  async function generate(){
    const text=getText();if(!text){setStatus("पहले story/script डालें।","err");return;}
    textEl.value=text;render();
    generateEl.disabled=true;generateEl.textContent="⏳ Creating voices…";audioBox.classList.add("hidden");
    try{
      const batches=groupedBatches(text);if(!batches.length)throw new Error("No speakable text found.");
      const parts=[];
      for(let i=0;i<batches.length;i++){
        const b=batches[i],p=profiles[normalize(b.speaker)]||{voice:"alloy",emotion:"Natural",intensity:60};
        setStatus(`🎙️ Voice तैयार हो रही है…\n${b.speaker} • Part ${i+1} / ${batches.length}`);
        const r=await fetch(API_BASE+"/api/tts-one",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:b.text,speaker:b.speaker+" [profile]",voice:p.voice,emotion:`${p.emotion} — ${p.intensity}% intensity`,language:document.getElementById("language")?.value||"Hindi"})});
        if(!r.ok){let m="TTS request failed";try{m=(await r.json()).error||m}catch{}throw new Error(m)}
        parts.push(await r.blob());
      }
      lastBlob=new Blob(parts,{type:"audio/mpeg"});audioEl.src=URL.createObjectURL(lastBlob);audioBox.classList.remove("hidden");setStatus(`✅ Multi-speaker voice तैयार है। ${batches.length} voice part(s) joined.\nPlay या Download MP3 करें।`,`ok`);
    }catch(e){setStatus("❌ "+e.message,"err")}
    finally{generateEl.disabled=false;generateEl.textContent="🎙️ Generate Multi-Speaker Voice"}
  }

  document.getElementById("msvAdd").addEventListener("click",()=>{
    const name=prompt("Speaker name");if(!name?.trim())return;const key=normalize(name);if(!profiles[key]){profiles[key]={name:name.trim(),voice:defaultVoice(name,new Set(Object.values(profiles).map(p=>p.voice))),emotion:"Natural",intensity:70};saveProfiles();}
    render();
  });
  document.getElementById("msvBack").addEventListener("click",()=>window.go?.("director"));
  generateEl.addEventListener("click",generate);
  document.getElementById("msvDownload").addEventListener("click",()=>{if(!lastBlob)return;const a=document.createElement("a");a.href=URL.createObjectURL(lastBlob);a.download="story-director-multi-speaker.mp3";a.click()});
  textEl.addEventListener("input",()=>{const script=document.getElementById("script");if(script)script.value=textEl.value;render()});
  document.getElementById("script")?.addEventListener("input",()=>{if(document.activeElement!==textEl){textEl.value=document.getElementById("script").value;render()}});
  document.getElementById("voiceText")?.addEventListener("input",()=>{if(document.activeElement!==textEl){textEl.value=document.getElementById("voiceText").value;render()}});
  syncText();
    /* ===== FINAL ULTRA-COMPACT SPEAKER CARD OVERRIDE ===== */
  const compactOverride = document.createElement("style");
  compactOverride.textContent = `
    /* Voice Studio shell */
    #multiSpeakerVoice.msv-shell{
      margin-top:3px !important;
    }

    #multiSpeakerVoice .msv-panel{
      padding:7px !important;
      border-radius:13px !important;
    }

    /* Header */
    #multiSpeakerVoice .msv-head{
      align-items:center !important;
      gap:6px !important;
    }

    #multiSpeakerVoice .msv-head h3{
      font-size:16px !important;
      line-height:1.1 !important;
      margin:0 !important;
    }

    #multiSpeakerVoice .msv-head p{
      font-size:8px !important;
      margin:2px 0 0 !important;
    }

    #multiSpeakerVoice .msv-add{
      min-height:30px !important;
      height:30px !important;
      padding:4px 8px !important;
      border-radius:9px !important;
      font-size:10px !important;
    }

    #multiSpeakerVoice .msv-note{
      margin:5px 0 4px !important;
      font-size:8px !important;
      line-height:1.2 !important;
    }

    /* Hide column labels — cards explain themselves */
    #multiSpeakerVoice .msv-labels{
      display:none !important;
    }

    /* Character list */
    #multiSpeakerVoice .msv-rows{
      display:grid !important;
      gap:3px !important;
      max-height:360px !important;
      padding:0 !important;
    }

    /* COMPACT SPEAKER CARD */
    #multiSpeakerVoice .msv-row{
      display:grid !important;
      grid-template-columns:82px minmax(0,1fr) 128px !important;
      align-items:center !important;
      gap:4px !important;
      padding:4px !important;
      min-height:34px !important;
      height:auto !important;
      border-radius:8px !important;
    }

    /* Speaker */
    #multiSpeakerVoice .msv-speaker{
      min-width:0 !important;
      gap:4px !important;
    }

    #multiSpeakerVoice .msv-avatar{
      width:21px !important;
      height:21px !important;
      min-width:21px !important;
      font-size:10px !important;
    }

    #multiSpeakerVoice .msv-name{
      font-size:8px !important;
      line-height:1 !important;
    }

    #multiSpeakerVoice .msv-type{
      font-size:6px !important;
      line-height:1 !important;
      margin-top:1px !important;
    }

    /* Voice selector */
    #multiSpeakerVoice .msv-voice{
      width:100% !important;
      min-width:0 !important;
      min-height:24px !important;
      height:24px !important;
      padding:2px 4px !important;
      border-radius:6px !important;
      font-size:7.5px !important;
      line-height:1 !important;
    }

    /* Emotion = one compact horizontal control */
    #multiSpeakerVoice .msv-emotion{
      display:grid !important;
      grid-template-columns:24px minmax(0,1fr) 22px !important;
      align-items:center !important;
      gap:2px !important;
      min-width:0 !important;
      height:24px !important;
      padding:0 !important;
      margin:0 !important;
    }

    #multiSpeakerVoice .msv-emotion-label{
      font-size:6px !important;
      line-height:1 !important;
    }

    #multiSpeakerVoice .msv-emotion input[type="range"]{
      width:100% !important;
      height:10px !important;
      margin:0 !important;
      padding:0 !important;
    }

    #multiSpeakerVoice .msv-emotion output{
      font-size:7px !important;
      line-height:1 !important;
      text-align:right !important;
      padding:0 !important;
    }

    /* Remove button, if present */
    #multiSpeakerVoice .msv-remove{
      width:22px !important;
      height:22px !important;
      min-width:22px !important;
      padding:0 !important;
      margin:0 !important;
      font-size:13px !important;
      border-radius:6px !important;
    }

    /* Text area */
    #multiSpeakerVoice .msv-text-field{
      margin-top:6px !important;
    }

    #multiSpeakerVoice .msv-text-field label{
      font-size:9px !important;
      margin-bottom:3px !important;
    }

    #multiSpeakerVoice .msv-text-field textarea{
      min-height:70px !important;
      height:70px !important;
      padding:7px 8px !important;
      border-radius:9px !important;
      font-size:11px !important;
    }

    /* Actions */
    #multiSpeakerVoice .msv-actions{
      margin-top:6px !important;
      gap:5px !important;
    }

    /* Generate remains FULL WIDTH */
    #multiSpeakerVoice .msv-actions #msvGenerate{
      grid-column:1 / -1 !important;
      width:100% !important;
      min-height:40px !important;
      height:40px !important;
      padding:6px 8px !important;
      font-size:11px !important;
      border-radius:12px !important;
    }

    /* Back button compact */
    #multiSpeakerVoice .msv-actions #msvBack{
      min-height:32px !important;
      height:32px !important;
      font-size:9px !important;
    }

    @media(max-width:430px){
      #multiSpeakerVoice .msv-row{
        grid-template-columns:76px minmax(0,1fr) 112px !important;
        gap:3px !important;
        padding:3px !important;
      }

      #multiSpeakerVoice .msv-panel{
        padding:6px !important;
      }

      #multiSpeakerVoice .msv-head h3{
        font-size:15px !important;
      }

      #multiSpeakerVoice .msv-add{
        min-height:29px !important;
        height:29px !important;
        font-size:9px !important;
      }

      #multiSpeakerVoice .msv-avatar{
        width:20px !important;
        height:20px !important;
        min-width:20px !important;
      }

      #multiSpeakerVoice .msv-name{
        font-size:7.5px !important;
      }

      #multiSpeakerVoice .msv-voice{
        min-height:23px !important;
        height:23px !important;
        font-size:7px !important;
      }

      #multiSpeakerVoice .msv-emotion{
        height:23px !important;
        grid-template-columns:22px minmax(0,1fr) 20px !important;
      }

      #multiSpeakerVoice .msv-emotion output{
        font-size:6.5px !important;
      }

      #multiSpeakerVoice .msv-actions #msvGenerate{
        min-height:39px !important;
        height:39px !important;
      }
    }
  `;

  document.head.appendChild(compactOverride);
})();
