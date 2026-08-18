const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...CORS}});
const text=(s,status=200)=>new Response(s,{status,headers:{"Content-Type":"text/plain; charset=utf-8",...CORS}});
const OPENAI="https://api.openai.com/v1";

export default {
 async fetch(request,env){
  if(request.method==="OPTIONS")return new Response(null,{headers:CORS});
  const url=new URL(request.url);

  try{
   if(request.method==="GET"&&url.pathname==="/")
    return text("Story Director V16 API is running.");

   if(request.method!=="POST")
    return json({error:"POST required"},405);

   if(!env.OPENAI_API_KEY)
    return json({error:"OPENAI_API_KEY secret is not configured in this Worker."},500);

   const body=await request.json();

   if(url.pathname==="/api/generate"){
    const {
     idea,
     language="Hindi",
     genre="Drama",
     length="medium",
     style="Cinematic",
     age="General",
     format="Dialogue Dominant — 80–90% Dialogue",
     extra=""
    }=body;

    if(!idea?.trim())
     return json({error:"Story idea is required."},400);

    const prompt=`Write a high-quality ${language} ${genre} story. Style: ${style}. Length: ${length}. Age mode: ${age}. Output: ${format}. Extra direction: ${extra||"none"}.
Keep narration natural and concise. Make characters distinct. If the requested language is Bhojpuri or Purvanchali/Banarasi, use natural spoken language rather than literal translation. Prefer dialogue when dialogue-dominant is selected. Return only the finished story/script, with no preface. Story idea: ${idea}`;

    const r=await fetch(OPENAI+"/responses",{
     method:"POST",
     headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${env.OPENAI_API_KEY}`
     },
     body:JSON.stringify({
      model:env.OPENAI_TEXT_MODEL||"gpt-5.6",
      input:prompt
     })
    });

    const j=await r.json();

    if(!r.ok)
     return json({error:j.error?.message||"OpenAI story generation failed."},r.status);

    return json({
     story:j.output_text||extractText(j)
    });
   }

   if(url.pathname==="/api/analyze"){
    const {
     story,
     mode="Full Director Mode",
     dialogueLanguage="Keep original"
    }=body;

    if(!story?.trim())
     return json({error:"Story is required."},400);

    const prompt=`You are a story director. Analyze this script for ${mode}. Dialogue language: ${dialogueLanguage}. Identify speakers, narration, scene breaks and voice-ready structure. If dialogueLanguage is not Keep original, translate ONLY spoken dialogue into that dialect while keeping narration in its original language. Return two sections: DIRECTOR NOTES and VOICE READY SCRIPT. Story:
${story}`;

    const r=await fetch(OPENAI+"/responses",{
     method:"POST",
     headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${env.OPENAI_API_KEY}`
     },
     body:JSON.stringify({
      model:env.OPENAI_TEXT_MODEL||"gpt-5.6",
      input:prompt
     })
    });

    const j=await r.json();

    if(!r.ok)
     return json({
      error:j.error?.message||"OpenAI analysis failed."
     },r.status);

    const out=j.output_text||extractText(j);
    const split=out.split(/VOICE READY SCRIPT/i);

    return json({
     analysis:split[0]?.trim()||out,
     voiceText:split[1]?.replace(/^[:\s]+/,"").trim()||story
    });
   }

   if(url.pathname==="/api/tts"){
    const {
     text:input,
     voice="alloy",
     emotion="Natural",
     language="Hindi"
    }=body;

    if(!input?.trim())
     return json({error:"Text is required."},400);

    const instructions=`Speak naturally in ${language}. Emotion: ${emotion}. Preserve pronunciation, names and pauses. Do not read scene labels or formatting symbols aloud.`;

    // Long text को छोटे हिस्सों में बाँटना
    const chunks=splitTTS(input,3000);
    const audioParts=[];

    for(let i=0;i<chunks.length;i++){

     const r=await fetch(OPENAI+"/audio/speech",{
      method:"POST",
      headers:{
       "Content-Type":"application/json",
       "Authorization":`Bearer ${env.OPENAI_API_KEY}`
      },
      body:JSON.stringify({
       model:env.OPENAI_TTS_MODEL||"gpt-4o-mini-tts",
       voice,
       input:chunks[i],
       format:"mp3",
       instructions
      })
     });

     if(!r.ok){
      const j=await r.json().catch(()=>({}));

      return json({
       error:j.error?.message||
       `OpenAI TTS failed on part ${i+1} of ${chunks.length}.`
      },r.status);
     }

     audioParts.push(
      new Uint8Array(await r.arrayBuffer())
     );
    }

    // सभी MP3 parts को एक audio response में जोड़ना
    const total=audioParts.reduce(
     (n,p)=>n+p.byteLength,
     0
    );

    const combined=new Uint8Array(total);

    let offset=0;

    for(const part of audioParts){
     combined.set(part,offset);
     offset+=part.byteLength;
    }

    return new Response(combined.buffer,{
     status:200,
     headers:{
      "Content-Type":"audio/mpeg",
      "Content-Length":String(total),
      "Cache-Control":"no-store",
      ...CORS
     }
    });
   }

   return json({error:"Unknown endpoint."},404);

  }catch(e){
   return json({
    error:e.message||"Worker error"
   },500);
  }
 }
};


// Long TTS text splitter
function splitTTS(text,maxChars=3000){

 const cleaned=text
  .replace(/\r/g,"")
  .trim();

 const sentences=
  cleaned.match(/[^।!?\n]+[।!?]+|[^।!?\n]+$/gu)
  ||[cleaned];

 const chunks=[];
 let current="";

 for(const raw of sentences){

  const sentence=raw.trim();

  if(!sentence)continue;

  // सामान्य sentence
  if(sentence.length<=maxChars){

   if(
    (current+" "+sentence)
    .trim()
    .length<=maxChars
   ){

    current=(current+" "+sentence).trim();

   }else{

    if(current)
     chunks.push(current);

    current=sentence;
   }

   continue;
  }

  // बहुत लंबा sentence
  if(current){
   chunks.push(current);
   current="";
  }

  const words=sentence.split(/\s+/);
  let part="";

  for(const word of words){

   if(!part){

    part=word;

   }else if(
    (part+" "+word).length<=maxChars
   ){

    part+=" "+word;

   }else{

    chunks.push(part);
    part=word;
   }
  }

  if(part)
   current=part;
 }

 if(current)
  chunks.push(current);

 return chunks.length
  ?chunks
  :[cleaned];
}


function extractText(j){

 return (j.output||[])
  .flatMap(x=>x.content||[])
  .filter(x=>x.type==="output_text")
  .map(x=>x.text)
  .join("\n")
  .trim();
}
