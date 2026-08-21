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

1. Identify every speaker from the story using names, dialogue attribution, context, grammar, and surrounding narration.
2. Identify narration separately.
3. Identify scene breaks.
4. Infer male/female character voice assignment only from reliable contextual or linguistic evidence.
5. Prepare a clean voice-ready script.
6. Preserve the original meaning, wording, tone, and sequence as much as possible.
7. If dialogueLanguage is not "Keep original", translate ONLY spoken dialogue.
8. Keep narration in its original language.
9. Keep speaker labels in the output so the voice engine can identify them.
10. Do NOT put character names inside their spoken sentences.
11. Narration must be clearly marked as "वाचक:".
12. Every dialogue line should have exactly one speaker label.

CONTENT-NEUTRAL DIRECTOR RULES:

13. Do NOT censor, sanitize, remove, shorten, replace, soften, rewrite, or omit story content because of mature, adult, sexual, romantic, violent, provocative, vulgar, or otherwise sensitive subject matter.
14. Do NOT change speaker assignment because of the content of a line.
15. Speaker assignment must be based only on who is actually speaking, using story context and linguistic evidence.
16. Preserve adult/mature wording when preparing the voice-ready script.
17. Do not insert warnings, safety notes, moral commentary, or moderation explanations into the story.
18. Do not refuse to analyze a story merely because its subject matter is mature or adult.
19. The Director's job is analysis, speaker identification, emotion/delivery direction, and voice preparation — NOT content moderation or rewriting.
20. Preserve the author's intended emotional and dramatic context.

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

     /* ==========================================
   SINGLE-CALL TTS
   One Worker invocation = one OpenAI TTS call
========================================== */

if (url.pathname === "/api/tts-one") {

  const {
    text: input,
    speaker = "वाचक",
    voice = "alloy",
    emotion = "Natural",
    language = "Hindi"
  } = body;

  if (!input?.trim()) {
    return json({
      error: "Text is required."
    }, 400);
  }

  const selectedVoice =
    getSpeakerVoice(speaker, voice);

  const instructions =
    buildVoiceInstructions(
      speaker,
      selectedVoice,
      emotion,
      language,
      input.trim()
    );

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

        input: input.trim(),

        format: "mp3",

        speed:
          selectedVoice === "onyx"
            ? 1.0
            : 1.08,

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

  const audio =
    await r.arrayBuffer();

  return new Response(audio, {
    status: 200,

    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length":
        String(audio.byteLength),

      "Cache-Control": "no-store",

      ...CORS
    }
  });
}
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

          const chunks = splitTTS(spokenText, 3900);

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
    speed: selectedVoice === "onyx" ? 1.0 : 1.08,
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

    let line = raw.trim();

    if (!line) continue;

    /*
      Remove common Markdown formatting
      around speaker names.

      Examples:
      **रवि:** Hello
      *रवि:* Hello
      ### रवि: Hello
      रवि: Hello
    */

    line = line
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*(.*?)\*\*$/, "$1")
      .trim();

    /*
      Standard speaker format:

      रवि: ...
      नेहा: ...
      वाचक: ...
      Narrator: ...
    */

    let match = line.match(
      /^([A-Za-z\u0900-\u097F][A-Za-z0-9\u0900-\u097F _-]{0,40})\s*:\s*(.*)$/u
    );

    /*
      Also recognize:

      रवि — ...
      रवि - ...
      रवि – ...
    */

    if (!match) {

      match = line.match(
        /^([A-Za-z\u0900-\u097F][A-Za-z0-9\u0900-\u097F _-]{0,40})\s*[—–-]\s+(.+)$/u
      );
    }

    if (match) {

      if (currentText.trim()) {

        result.push({
          speaker: currentSpeaker,
          text: currentText.trim()
        });
      }

      currentSpeaker = match[1]
        .replace(/^\*+|\*+$/g, "")
        .trim();

      currentText = match[2]
        .replace(/^\*+|\*+$/g, "")
        .trim();

    } else {

      /*
        Unlabelled text continues
        the current speaker.
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

  /*
    Final cleanup:
    remove accidental Markdown speaker
    markers from the actual spoken text.
  */

  return result
    .map(item => ({
      speaker: item.speaker
        .replace(/^\*+|\*+$/g, "")
        .trim(),

      text: item.text
        .replace(/^\*+|\*+$/g, "")
        .trim()
    }))
    .filter(item => item.text);
}


/* ==========================================
   SMART SPEAKER VOICE
========================================== */

const MALE_CHARACTER_VOICES = [
  "alloy",
  "echo",
  "fable",
  "ash",
  "sage",
  "verse"
];

const FEMALE_CHARACTER_VOICES = [
  "nova",
  "shimmer",
  "coral",
  "ballad",
  "marin",
  "cedar"
];

function getCharacterVoice(name, names, voices) {
  const index = names.findIndex(
    n => name === normalizeSpeaker(n)
  );

  if (index < 0) {
    return voices[0];
  }

  return voices[index % voices.length];
}
function getSpeakerVoice(speaker, fallbackVoice) {
  const name = normalizeSpeaker(speaker);

  // ==============================
  // NARRATOR = ALWAYS ONYX
  // ==============================
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

  // ==============================
  // FEMALE = NOVA / SHIMMER ONLY
  // ==============================
  const femaleVoices = [
    "nova",
    "shimmer"
  ];

  const femaleNames = [
    "नेहा",
    "neha",
    "पूजा",
    "pooja",
    "रीना",
    "reena",
    "सीमा",
    "seema",
    "सुनीता",
    "sunita",
    "कविता",
    "kavita",
    "राधा",
    "radha",
    "प्रिया",
    "priya",
    "सोनिया",
    "sonia"
  ];

  if (
    femaleNames.some(
      n => name === normalizeSpeaker(n)
    )
  ) {
    return getCharacterVoice(
      name,
      femaleVoices,
      FEMALE_CHARACTER_VOICES
    );
  }

  // ==============================
  // MALE = ALLOY / ECHO / FABLE
  // NEVER ONYX
  // ==============================
  const maleVoices = [
    "alloy",
    "echo",
    "fable"
  ];

  const maleNames = [
    "रवि",
    "ravi",
    "अमित",
    "amit",
    "रोहित",
    "rohit",
    "विकास",
    "vikas",
    "सुरेश",
    "suresh",
    "राज",
    "raj",
    "अजय",
    "ajay",
    "विजय",
    "vijay",
    "मोहन",
    "mohan",
    "राहुल",
    "rahul"
  ];

  if (
    maleNames.some(
      n => name === normalizeSpeaker(n)
    )
  ) {
    return getCharacterVoice(
      name,
      maleVoices,
      MALE_CHARACTER_VOICES
    );
  }

  // ==============================
  // SAFE CHARACTER FALLBACK
  // NEVER ONYX
  // ==============================
  if (
    typeof fallbackVoice === "string" &&
    ["alloy", "echo", "fable", "nova", "shimmer"]
      .includes(fallbackVoice.toLowerCase())
  ) {
    return fallbackVoice.toLowerCase();
  }

  return "alloy";
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
const contentRules = `
CONTENT-NEUTRAL SPEAKER RULES:

Speak the assigned text exactly as provided.

Do NOT censor, sanitize, remove, shorten, replace, soften, rewrite, or omit any part of the assigned text because of its subject matter.

Do NOT change, reinterpret, or refuse the text because it is adult, mature, romantic, sexual, violent, controversial, or otherwise sensitive.

Preserve the original wording, meaning, tone, and intended emotional context.

Do NOT add warnings, safety notes, moral commentary, or moderation statements.

Do NOT speak speaker labels, character names, "वाचक", "Narrator", or formatting markers unless they are explicitly part of the actual spoken dialogue.

The speaker must follow the Director's assigned role and emotion without changing the content.
`;
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
