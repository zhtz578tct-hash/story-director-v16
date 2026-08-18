const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS
    }
  });

const text = (s, status = 200) =>
  new Response(s, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...CORS
    }
  });

const OPENAI = "https://api.openai.com/v1";

export default {
  async fetch(request, env) {

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    try {

      /* =========================
         HEALTH CHECK
      ========================= */

      if (request.method === "GET" && url.pathname === "/") {
        return text("Story Director V16.1 API is running.");
      }

      if (request.method !== "POST") {
        return json({ error: "POST required" }, 405);
      }

      if (!env.OPENAI_API_KEY) {
        return json({
          error: "OPENAI_API_KEY secret is not configured in this Worker."
        }, 500);
      }

      const body = await request.json();

      /* =========================
         STORY GENERATOR
      ========================= */

      if (url.pathname === "/api/generate") {

        const {
          idea,
          language = "Hindi",
          genre = "Drama",
          length = "medium",
          style = "Cinematic",
          age = "General",
          format = "Dialogue Dominant — 80–90% Dialogue",
          extra = ""
        } = body;

        if (!idea?.trim()) {
          return json({
            error: "Story idea is required."
          }, 400);
        }

        const prompt = `
Write a high-quality ${language} ${genre} story.

Style: ${style}
Length: ${length}
Age mode: ${age}
Output: ${format}
Extra direction: ${extra || "none"}

IMPORTANT:
- Keep narration natural and concise.
- Make every character distinct.
- Use clear speaker labels such as "नेहा:" and "रवि:" before dialogue.
- Never make characters speak their own names as part of dialogue unless the story explicitly requires it.
- If dialogue-dominant is selected, prefer dialogue.
- If Hindi is requested, use natural modern spoken Hindi.
- If Bhojpuri or Purvanchali/Banarasi is requested, use natural spoken language rather than literal translation.
- Return only the finished story/script.
- Do not add explanations before or after the story.

Story idea:
${idea}
`;

        const r = await fetch(OPENAI + "/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: env.OPENAI_TEXT_MODEL || "gpt-5.6",
            input: prompt
          })
        });

        const j = await r.json();

        if (!r.ok) {
          return json({
            error:
              j.error?.message ||
              "OpenAI story generation failed."
          }, r.status);
        }

        return json({
          story: j.output_text || extractText(j)
        });
      }

      /* =========================
         DIRECTOR / ANALYSIS
      ========================= */

      if (url.pathname === "/api/analyze") {

        const {
          story,
          mode = "Full Director Mode",
          dialogueLanguage = "Keep original"
        } = body;

        if (!story?.trim()) {
          return json({
            error: "Story is required."
          }, 400);
        }

        const prompt = `
You are a professional story director and voice director.

Analyze this script for:
${mode}

Dialogue language:
${dialogueLanguage}

Your job:

1. Identify every speaker.
2. Identify narration.
3. Identify scene breaks.
4. Identify male and female characters.
5. Prepare a clean voice-ready script.
6. Preserve the original meaning.
7. If dialogueLanguage is not "Keep original", translate ONLY spoken dialogue.
8. Keep narration in its original language.
9. Keep speaker labels in the output so the voice engine can identify them.
10. Do NOT put character names inside their spoken sentences.
11. Narration must be clearly marked as "वाचक:".
12. Every dialogue line should have exactly one speaker label.

Return exactly two sections:

DIRECTOR NOTES

VOICE READY SCRIPT

Story:
${story}
`;

        const r = await fetch(OPENAI + "/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: env.OPENAI_TEXT_MODEL || "gpt-5.6",
            input: prompt
          })
        });

        const j = await r.json();

        if (!r.ok) {
          return json({
            error:
              j.error?.message ||
              "OpenAI analysis failed."
          }, r.status);
        }

        const out = j.output_text || extractText(j);

        const split = out.split(/VOICE READY SCRIPT/i);

        return json({
          analysis: split[0]?.trim() || out,
          voiceText:
            split[1]
              ?.replace(/^[:\s]+/, "")
              .trim() || story
        });
      }

      /* =========================
         SMART MULTI-SPEAKER TTS
      ========================= */

      if (url.pathname === "/api/tts") {

        const {
          text: input,
          voice = "alloy",
          emotion = "Natural",
          language = "Hindi"
        } = body;

        if (!input?.trim()) {
          return json({
            error: "Text is required."
          }, 400);
        }

        /*
         SMART VOICE MAP

         Narrator / वाचक -> Onyx
         Female characters -> Nova
         Male characters -> Alloy
        */

        const lines = parseScriptLines(input);

        const audioParts = [];

        for (const line of lines) {

          const speaker = line.speaker;
          const spokenText = line.text;

          if (!spokenText?.trim()) continue;

          const selectedVoice =
            getSpeakerVoice(speaker, voice);

          const instructions = buildVoiceInstructions(
    speaker,
    selectedVoice,
    emotion,
    language,
    spokenText
);

          const chunks = splitTTS(spokenText, 1800);

          for (const chunk of chunks) {

            const r = await fetch(
              OPENAI + "/audio/speech",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization":
                    `Bearer ${env.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                  model:
                    env.OPENAI_TTS_MODEL ||
                    "gpt-4o-mini-tts",

                  voice: selectedVoice,

                  input: chunk,

                  format: "mp3",

                  instructions
                })
              }
            );

            if (!r.ok) {

              const j =
                await r.json().catch(() => ({}));

              return json({
                error:
                  j.error?.message ||
                  "OpenAI TTS failed."
              }, r.status);
            }

            audioParts.push(
              new Uint8Array(
                await r.arrayBuffer()
              )
            );
          }
        }

        if (!audioParts.length) {
          return json({
            error: "No speakable text found."
          }, 400);
        }

        const total = audioParts.reduce(
          (n, p) => n + p.byteLength,
          0
        );

        const combined = new Uint8Array(total);

        let offset = 0;

        for (const part of audioParts) {
          combined.set(part, offset);
          offset += part.byteLength;
        }

        return new Response(combined.buffer, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(total),
            "Cache-Control": "no-store",
            ...CORS
          }
        });
      }

      return json({
        error: "Unknown endpoint."
      }, 404);

    } catch (e) {

      return json({
        error: e.message || "Worker error"
      }, 500);
    }
  }
};


/* ==========================================
   PARSE SCRIPT INTO SPEAKER + TEXT
========================================== */

function parseScriptLines(input) {

  const cleaned = input
    .replace(/\r/g, "")
    .trim();

  const rawLines = cleaned.split("\n");

  const result = [];

  let currentSpeaker = "वाचक";
  let currentText = "";

  for (const raw of rawLines) {

    const line = raw.trim();

    if (!line) continue;

    /*
      Recognize:

      नेहा: ...
      रवि: ...
      वाचक: ...
      Narrator: ...
      Neha: ...
      Ravi: ...
    */

    const match = line.match(
      /^([A-Za-z\u0900-\u097F][A-Za-z0-9\u0900-\u097F _-]{0,40})\s*:\s*(.*)$/u
    );

    if (match) {

      if (currentText.trim()) {

        result.push({
          speaker: currentSpeaker,
          text: currentText.trim()
        });
      }

      currentSpeaker = match[1].trim();

      currentText = match[2].trim();

    } else {

      /*
        Unlabelled text is treated as
        continuation of current speaker.
      */

      if (currentText) {
        currentText += " " + line;
      } else {
        currentText = line;
      }
    }
  }

  if (currentText.trim()) {

    result.push({
      speaker: currentSpeaker,
      text: currentText.trim()
    });
  }

  return result;
}


/* ==========================================
   SMART SPEAKER VOICE
========================================== */

function getSpeakerVoice(speaker, fallbackVoice) {

  const name = normalizeSpeaker(speaker);

  /* Narrator */

  const narratorNames = [
    "वाचक",
    "कथावाचक",
    "सूत्रधार",
    "नरेटर",
    "narrator",
    "narration",
    "voiceover",
    "voice over",
    "v.o.",
    "vo"
  ];

  if (
    narratorNames.some(
      n => name === normalizeSpeaker(n)
    )
  ) {
    return "onyx";
  }


  /* Female names */

  const femaleNames = [

    "नेहा",
    "रीमा",
    "सीमा",
    "पूजा",
    "राधा",
    "रानी",
    "सोनिया",
    "सोनम",
    "नेहा",
    "निशा",
    "आशा",
    "कविता",
    "सुनीता",
    "गीता",
    "सीमा",
    "अनिता",
    "अनीता",
    "संगीता",
    "प्रिया",
    "रिया",
    "दिया",
    "मीरा",
    "मीना",
    "रेखा",
    "मधु",
    "रुनी",
    "रूनी",
    "शालिनी",
    "किरण",
    "अंजली",
    "अंजलि",
    "स्वाति",
    "पायल",
    "पूनम",
    "लता",
    "सरिता",
    "वंदना",
    "वन्दना",
    "मोना",
    "ज्योति",
    "आरती",
    "नंदिनी",
    "नंदनी",
    "काजल",
    "तनु",
    "तन्वी",
    "साक्षी",
    "श्रुति",
    "रितु",
    "ऋतु",
    "निकिता",
    "ममता",
    "कमला",
    "शकुंतला",
    "गौरी",
    "सीमा",
    "मंजू",
    "मंजु",
    "रश्मि",
    "रश्मी",
    "सुमन",
    "सुनीता",
    "सरस्वती",
    "लक्ष्मी",
    "पार्वती",
    "राधिका",
    "सविता",
    "कुसुम",
    "चांदनी",
    "चाँदनी",
    "अमृता",
    "दीपा",
    "दीपिका",
    "करिश्मा",
    "श्रेया",
    "स्वरा",
    "कृति",
    "कृतिका",
    "आकांक्षा",
    "आराध्या",
    "सिमरन",
    "मेघा",
    "मेघना",
    "भूमि",
    "भावना",
    "मुस्कान",
    "खुशी",
    "पिंकी",
    "गुड़िया",
    "गुड्डी",
    "मधुमिता",
    "वर्षा",
    "वर्षा",
    "रूपा",
    "रूपाली",
    "फरहा",
    "नाज़िया",
    "नाजिया",
    "शबाना",
    "फातिमा",
    "आयशा",
    "सना",
    "ज़ोया",
    "जोया",
    "नूर",
    "आलिया",
    "रिया",
    "रुचि",
    "रुचिका",
    "विनीता",
    "अदिति",
    "अदिती",
    "इशिता",
    "इरा",
    "अनु",
    "अनुष्का",
    "काजरी",
    "कंचन",
    "चंचल",
    "डॉली",
    "बेबी"
  ];

  if (
    femaleNames.some(
      n => name === normalizeSpeaker(n)
    )
  ) {
    return "nova";
  }


  /*
    Explicit female indicators
  */

  if (
    name.includes("female") ||
    name.includes("girl") ||
    name.includes("woman") ||
    name.includes("ladki") ||
    name.includes("लड़की") ||
    name.includes("महिला") ||
    name.includes("औरत") ||
    name.includes("स्त्री")
  ) {
    return "nova";
  }


  /*
    Explicit male indicators
  */

  if (
    name.includes("male") ||
    name.includes("boy") ||
    name.includes("man") ||
    name.includes("ladka") ||
    name.includes("लड़का") ||
    name.includes("पुरुष") ||
    name.includes("आदमी")
  ) {
    return "alloy";
  }


  /*
    Known male names
  */

  const maleNames = [

    "रवि",
    "राहुल",
    "अमित",
    "रोहित",
    "अजय",
    "विजय",
    "संजय",
    "मनोज",
    "राज",
    "राजेश",
    "राकेश",
    "सुरेश",
    "मुकेश",
    "गृजेश",
    "ग्रिजेश",
    "आकाश",
    "आदित्य",
    "अंकित",
    "अभिषेक",
    "अभय",
    "अरुण",
    "वरुण",
    "दीपक",
    "पंकज",
    "नितिन",
    "विनय",
    "विकास",
    "विवेक",
    "मोहन",
    "सोहन",
    "करण",
    "अर्जुन",
    "रोहन",
    "अमन",
    "सुमित",
    "सुनील",
    "अनिल",
    "कमल",
    "प्रदीप",
    "प्रकाश",
    "दिनेश",
    "महेश",
    "रमेश",
    "राजीव",
    "देव",
    "देवेन्द्र",
    "देवेंद्र",
    "मनीष",
    "मयंक",
    "नवीन",
    "सचिन",
    "आनंद",
    "आशीष",
    "शिव",
    "शिवम",
    "कृष्ण",
    "कृष्णा",
    "गोपाल",
    "रवि",
    "राकेश",
    "फैसल",
    "फैज़",
    "फैज",
    "इमरान",
    "सलमान",
    "आरिफ",
    "अली",
    "समीर",
    "दानिश",
    "अमन"
  ];

  if (
    maleNames.some(
      n => name === normalizeSpeaker(n)
    )
  ) {
    return "alloy";
  }


  /*
    English common names
  */

  const femaleEnglish = [
    "neha",
    "reema",
    "seema",
    "pooja",
    "radha",
    "rani",
    "sonia",
    "sonam",
    "nisha",
    "asha",
    "kavita",
    "sunita",
    "geeta",
    "anita",
    "sangeeta",
    "priya",
    "riya",
    "diya",
    "meera",
    "meena",
    "rekha",
    "madhu",
    "runi",
    "shalini",
    "anjali",
    "swati",
    "payal",
    "poonam",
    "lata",
    "sarita",
    "vandana",
    "mona",
    "jyoti",
    "aarti",
    "nisha"
  ];

  if (
    femaleEnglish.some(
      n => name === normalizeSpeaker(n)
    )
  ) {
    return "nova";
  }


  const maleEnglish = [
    "ravi",
    "rahul",
    "amit",
    "rohit",
    "ajay",
    "vijay",
    "sanjay",
    "manoj",
    "raj",
    "rajesh",
    "rakesh",
    "suresh",
    "mukesh",
    "akash",
    "aditya",
    "ankit",
    "abhishek",
    "abhay",
    "arun",
    "varun",
    "deepak",
    "pankaj",
    "nitin",
    "vinay",
    "vikas",
    "vivek",
    "mohan",
    "sohan",
    "karan",
    "arjun",
    "rohan",
    "aman",
    "sumit",
    "sunil",
    "anil",
    "kamal",
    "pradeep",
    "prakash",
    "dinesh",
    "mahesh",
    "ramesh",
    "rajiv",
    "manish",
    "mayank",
    "naveen",
    "sachin",
    "anand",
    "ashish",
    "shiv",
    "shivam"
  ];

  if (
    maleEnglish.some(
      n => name === normalizeSpeaker(n)
    )
  ) {
    return "alloy";
  }


  /*
    Fallback:
    If the UI manually selected a voice,
    respect it.
  */

  return fallbackVoice || "alloy";
}


/* ==========================================
   VOICE INSTRUCTIONS
========================================== */

function buildVoiceInstructions(
  speaker,
  voice,
  emotion,
  language,
  spokenText = ""
) {

  const text = String(spokenText || "").trim();

  /* ==========================================
     SMART EXPRESSION DETECTION
     Works across supported languages
  ========================================== */

  const isQuestion =
    /[?？]/u.test(text) ||
    /\b(what|why|how|when|where|who|which|is|are|do|does|did|can|could|will|would)\b/i.test(text) ||
    /(क्या|क्यों|कैसे|कब|कहाँ|कहां|कौन|किस|किसका|किसे|कितना|कितनी|कितने|है क्या|सच में|का|काहे|कइसे|कइसन|के|कहाँवा|कबो)/u.test(text) ||
    /(کیا|کیوں|کیسے|کب|کہاں|کون|کس|کتنا|کتنی|کتنے)/u.test(text) ||
    /(काय|का|कशा|कसे|केव्हा|कुठे|कोण|किती)/u.test(text) ||
    /(কি|কেন|কীভাবে|কখন|কোথায়|কোথায়|কে|কত)/u.test(text);

  const isSurprised =
    /[!！]/u.test(text) ||
    /\b(wow|oh|oh my|really|what|amazing|suddenly)\b/i.test(text) ||
    /(अरे|अरे वाह|ओह|ओहो|हे भगवान|सच में|क्या!|हाय|अचानक|हे राम|बाप रे|अइं|अरे बाप रे)/u.test(text) ||
    /(اوہ|ارے|یا خدا|اچانک|واقعی)/u.test(text) ||
    /(अरे|अहो|अचानक|खरंच)/u.test(text) ||
    /(ওহ|আরে|হায়|সত্যি|হঠাৎ)/u.test(text);

  let expression = "";

  if (isQuestion && isSurprised) {
    expression = `
The line is both a QUESTION and a SURPRISED reaction.
Use a natural surprised-question intonation.
Raise pitch slightly at the beginning and naturally lift the ending.
Do not exaggerate.
`;
  } else if (isQuestion) {
    expression = `
This line is a QUESTION.
Use natural questioning intonation.
Let the voice rise naturally where appropriate, especially toward the end.
Do not make it sound robotic or exaggerated.
`;
  } else if (isSurprised) {
    expression = `
This line expresses SURPRISE.
Use a brief, natural startled reaction.
Slightly increase vocal energy and pitch.
Keep it believable and conversational.
Do not over-act.
`;
  } else {
    expression = `
Use natural conversational delivery appropriate to the meaning of the line.
`;
  }


  /* ==========================================
     NARRATOR — EXCLUSIVE ONYX
  ========================================== */

  if (voice === "onyx") {

    return `
You are the exclusive narrator voice.

Speak in natural ${language}.

Use a calm, warm, cinematic male narrator style.

Emotion:
${emotion}

${expression}

Do NOT speak the speaker name.

Do NOT say "वाचक", "Narrator", or any label.

Do not read formatting symbols.

Preserve natural pronunciation of ${language}.

Use short, natural pauses.

Do not over-act.

Keep narration clearly different from character dialogue.
`;
  }


  /* ==========================================
     FEMALE CHARACTER — NOVA
  ========================================== */

  if (voice === "nova") {

    return `
You are a female character voice.

Speak naturally in ${language}.

Character:
${speaker}

Emotion:
${emotion}

${expression}

Do NOT speak the character's name.

Do NOT announce the speaker.

Do not read labels or formatting symbols.

Use natural conversational ${language} pronunciation.

Use emotionally appropriate pauses.

Avoid robotic or exaggerated acting.

The character should sound like a real person speaking naturally.
`;
  }


  /* ==========================================
     MALE CHARACTER — ALLOY
  ========================================== */

  return `
You are a male character voice.

Speak naturally in ${language}.

Character:
${speaker}

Emotion:
${emotion}

${expression}

Do NOT speak the character's name.

Do NOT announce the speaker.

Do not read labels or formatting symbols.

Use natural conversational ${language} pronunciation.

Use emotionally appropriate pauses.

Avoid robotic or exaggerated acting.

The character should sound like a real person speaking naturally.
`;
}


/* ==========================================
   NORMALIZE SPEAKER NAME
========================================== */

function normalizeSpeaker(value) {

  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[“”"']/g, "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


/* ==========================================
   LONG TTS SPLITTER
========================================== */

function splitTTS(text, maxChars = 1800) {

  const cleaned = text
    .replace(/\r/g, "")
    .trim();

  if (!cleaned) {
    return [];
  }

  const sentences =
    cleaned.match(
      /[^।!?！？\n]+[।!?！？]+|[^।!?！？\n]+$/gu
    ) || [cleaned];

  const chunks = [];

  let current = "";

  for (const raw of sentences) {

    const sentence = raw.trim();

    if (!sentence) continue;

    if (sentence.length <= maxChars) {

      const combined =
        (current + " " + sentence).trim();

      if (combined.length <= maxChars) {

        current = combined;

      } else {

        if (current) {
          chunks.push(current);
        }

        current = sentence;
      }

      continue;
    }


    if (current) {
      chunks.push(current);
      current = "";
    }


    const words = sentence.split(/\s+/);

    let part = "";

    for (const word of words) {

      if (!part) {

        part = word;

      } else if (
        (part + " " + word).length <= maxChars
      ) {

        part += " " + word;

      } else {

        chunks.push(part);
        part = word;
      }
    }

    if (part) {
      current = part;
    }
  }


  if (current) {
    chunks.push(current);
  }

  return chunks.length
    ? chunks
    : [cleaned];
}


/* ==========================================
   OPENAI RESPONSE TEXT EXTRACTION
========================================== */

function extractText(j) {

  return (j.output || [])
    .flatMap(x => x.content || [])
    .filter(x => x.type === "output_text")
    .map(x => x.text)
    .join("\n")
    .trim();
}
