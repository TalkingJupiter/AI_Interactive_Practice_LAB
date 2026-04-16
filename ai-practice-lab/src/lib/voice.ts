type SpeechRecognitionConstructor = new () => SpeechRecognition;

type BrowserSpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export type SpeakOptions = {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (event: SpeechSynthesisErrorEvent) => void;
};

export type ListenResult = {
  transcript: string;
  finalTranscript: string;
  interimTranscript: string;
  isFinal: boolean;
  event: SpeechRecognitionEvent;
};

export type ListenOptions = {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  onStart?: () => void;
  onResult: (result: ListenResult) => void;
  onEnd?: () => void;
  onError?: (error: SpeechRecognitionErrorEvent | Error) => void;
};

let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentRecognition: SpeechRecognition | null = null;
let listening = false;

function getBrowserWindow(): BrowserSpeechWindow | null {
  if (typeof window === "undefined") return null;
  return window as BrowserSpeechWindow;
}

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) return null;

  return (
    browserWindow.SpeechRecognition ??
    browserWindow.webkitSpeechRecognition ??
    null
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeSpaces(text: string) {
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function prepareTextForSpeech(markdown: string) {
  return normalizeSpaces(
    markdown
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}[-*+]\s+/gm, "")
      .replace(/^\s{0,3}\d+[.)]\s+/gm, "")
      .replace(/^\s*>+\s?/gm, "")
      .replace(/[*_~#]/g, "")
      .replace(/^\s*[-=]{3,}\s*$/gm, "")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
  );
}


export function canSpeak() {
  const browserWindow = getBrowserWindow();
  return Boolean(browserWindow?.speechSynthesis);
}

export function isSpeaking() {
  const browserWindow = getBrowserWindow();
  return Boolean(currentUtterance || browserWindow?.speechSynthesis.speaking);
}

export function speak(markdown: string, options: SpeakOptions = {}) {
  if (!canSpeak()) return false;

  const text = prepareTextForSpeech(markdown);
  if (!text) return false;

  stopListening();
  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options.lang ?? "en-US";
  utterance.rate = clamp(options.rate ?? 1, 0.1, 10);
  utterance.pitch = clamp(options.pitch ?? 1, 0, 2);
  utterance.volume = clamp(options.volume ?? 1, 0, 1);

  if (options.voice) {
    utterance.voice = options.voice;
  }

  utterance.onstart = () => {
    options.onStart?.();
  };

  utterance.onend = () => {
    currentUtterance = null;
    options.onEnd?.();
  };

  utterance.onerror = (event) => {
    currentUtterance = null;
    options.onError?.(event);
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (!window?.speechSynthesis) return;
  currentUtterance = null;
  window.speechSynthesis.cancel();
}

export function canListen() {
  return Boolean(getRecognitionConstructor());
}

export function isListening() {
  return listening;
}

export function startListening(options: ListenOptions) {
  const Recognition = getRecognitionConstructor();
  if (!Recognition) return false;

  stopSpeaking();
  stopListening();

  const recognition = new Recognition();
  recognition.lang = options.lang ?? "en-US";
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? true;
  recognition.maxAlternatives = options.maxAlternatives ?? 1;

  recognition.onstart = () => {
    listening = true;
    options.onStart?.();
  };

  recognition.onresult = (event) => {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0]?.transcript ?? "";

      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const normalizedFinal = normalizeSpaces(finalTranscript);
    const normalizedInterim = normalizeSpaces(interimTranscript);
    const transcript = normalizeSpaces(
      `${normalizedFinal} ${normalizedInterim}`
    );

    const isFinal = event.results[event.resultIndex]?.isFinal ?? false;

    options.onResult({
      transcript,
      finalTranscript: normalizedFinal,
      interimTranscript: normalizedInterim,
      isFinal,
      event,
    });
  };

  recognition.onerror = (event) => {
    options.onError?.(event);
  };

  recognition.onend = () => {
    listening = false;
    if (currentRecognition === recognition) {
      currentRecognition = null;
    }
    options.onEnd?.();
  };

  currentRecognition = recognition;
  recognition.onaudiostart = () => {
    console.log("[speech] onaudiostart");
  };

  recognition.onaudioend = () => {
    console.log("[speech] onaudioend");
  };

  recognition.onsoundstart = () => {
    console.log("[speech] onsoundstart");
  };

  recognition.onsoundend = () => {
    console.log("[speech] onsoundend");
  };

  recognition.onspeechstart = () => {
    console.log("[speech] onspeechstart");
  };

  recognition.onspeechend = () => {
    console.log("[speech] onspeechend");
  };

  recognition.onnomatch = () => {
    console.log("[speech] onnomatch");
  };

  recognition.onstart = () => {
    console.log("[speech] onstart");
    listening = true;
    options.onStart?.();
  };

  recognition.onresult = (event) => {
    console.log("[speech] onresult", event);
    let finalTranscript = "";
    let interimTranscript = "";

    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0]?.transcript ?? "";

      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const normalizedFinal = normalizeSpaces(finalTranscript);
    const normalizedInterim = normalizeSpaces(interimTranscript);
    const transcript = normalizeSpaces(
      `${normalizedFinal} ${normalizedInterim}`
    );

    const isFinal = event.results[event.resultIndex]?.isFinal ?? false;

    options.onResult({
      transcript,
      finalTranscript: normalizedFinal,
      interimTranscript: normalizedInterim,
      isFinal,
      event,
    });
  };

  recognition.onerror = (event) => {
    console.log("[speech] onerror", event.error, event.message, event);
    options.onError?.(event);
  };

  recognition.onend = () => {
    console.log("[speech] onend");
    listening = false;
    if (currentRecognition === recognition) {
      currentRecognition = null;
    }
    options.onEnd?.();
  };
  try {
    recognition.start();
    return true;
  } catch (error) {
    listening = false;
    currentRecognition = null;
    options.onError?.(
      error instanceof Error ? error : new Error("Speech recognition failed")
    );
    return false;
  }
}

export function stopListening() {
  if (!currentRecognition) return;

  const recognition = currentRecognition;
  currentRecognition = null;
  listening = false;

  try {
    recognition.stop();
  } catch (error) {
    console.warn("[speech] stopListening error:", error);
  }
}

export function abortListening() {
  if (!currentRecognition) return;

  const recognition = currentRecognition;
  currentRecognition = null;
  listening = false;

  try {
    recognition.abort();
  } catch (error) {
    console.warn("[speech] abortListening error:", error);
  }
}