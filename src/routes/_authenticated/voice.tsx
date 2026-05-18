import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, Loader2, Sparkles, Square } from "lucide-react";
import { askVoiceTutor } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/voice")({
  head: () => ({
    meta: [
      { title: "Voice Tutor — RAW" },
      { name: "description", content: "Talk to your AI tutor with your voice." },
    ],
  }),
  component: VoicePage,
});

type Turn = { role: "user" | "assistant"; text: string; at: number };

// Web Speech API typing shims (TS doesn't ship these)
type SR = any;
const SpeechRecognitionCtor: (new () => SR) | undefined =
  typeof window !== "undefined"
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined;

function VoicePage() {
  const ask = useServerFn(askVoiceTutor);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [interim, setInterim] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const recRef = useRef<SR | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SpeechRecognitionCtor || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      if (!voiceURI && list.length) {
        const preferred =
          list.find((v) => /en-US/i.test(v.lang) && /Google|Samantha|Natural/i.test(v.name)) ||
          list.find((v) => /en/i.test(v.lang)) ||
          list[0];
        setVoiceURI(preferred.voiceURI);
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
      recRef.current?.abort?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, interim, thinking]);

  const speak = (text: string) => {
    if (muted || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = voices.find((x) => x.voiceURI === voiceURI);
    if (v) u.voice = v;
    u.rate = 1.0;
    u.pitch = 1.0;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const handleQuestion = async (text: string) => {
    setTurns((t) => [...t, { role: "user", text, at: Date.now() }]);
    setThinking(true);
    try {
      const res = await ask({ data: { question: text } });
      setTurns((t) => [...t, { role: "assistant", text: res.reply, at: Date.now() }]);
      speak(res.reply);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setThinking(false);
    }
  };

  const startListening = () => {
    if (!SpeechRecognitionCtor) return;
    stopSpeaking();
    const rec: SR = new SpeechRecognitionCtor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    let finalText = "";

    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error === "not-allowed") toast.error("Microphone access denied.");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast.error(`Mic error: ${e.error}`);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalText.trim();
      if (text) handleQuestion(text);
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      // already started
    }
  };

  const stopListening = () => {
    recRef.current?.stop?.();
  };

  if (!supported) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display text-3xl font-bold">Voice Tutor</h1>
        <p className="mt-3 text-muted-foreground">
          Your browser doesn't support the Web Speech API. Please use the latest Chrome, Edge, or Safari to talk with the tutor.
        </p>
      </div>
    );
  }

  const idle = !listening && !thinking && !speaking;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Voice Tutor</h1>
            <p className="text-xs text-muted-foreground">
              Tap the mic, ask your doubt out loud, and the tutor will speak back.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={voiceURI}
              onChange={(e) => setVoiceURI(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs"
              aria-label="Voice"
            >
              {voices
                .filter((v) => /^en/i.test(v.lang))
                .map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                stopSpeaking();
                setMuted((m) => !m);
              }}
              title={muted ? "Unmute responses" : "Mute responses"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 md:px-10">
        <div className="mx-auto max-w-2xl space-y-4">
          {turns.length === 0 && !interim && (
            <div className="bg-gradient-card rounded-2xl border border-border p-8 text-center shadow-card">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="font-display text-lg font-semibold">Ready when you are.</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Press the big mic button below and ask anything — math, science, history, languages.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border px-2.5 py-1">"Explain photosynthesis simply"</span>
                <span className="rounded-full border border-border px-2.5 py-1">"What is a derivative?"</span>
                <span className="rounded-full border border-border px-2.5 py-1">"Help me with French verbs"</span>
              </div>
            </div>
          )}

          {turns.map((t, i) => (
            <div
              key={i}
              className={`flex ${t.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-card ${
                  t.role === "user"
                    ? "bg-foreground text-background"
                    : "bg-gradient-card border border-border"
                }`}
              >
                {t.text}
              </div>
            </div>
          ))}

          {interim && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl border border-dashed border-border px-4 py-3 text-sm italic text-muted-foreground">
                {interim}
              </div>
            </div>
          )}

          {thinking && (
            <div className="flex justify-start">
              <div className="bg-gradient-card flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mic dock */}
      <div className="border-t border-border bg-background/80 px-6 py-6 backdrop-blur md:px-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <div className="relative">
            {listening && (
              <>
                <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-foreground/30" />
                <span className="absolute inset-0 -m-4 animate-pulse rounded-full bg-foreground/10" />
              </>
            )}
            {speaking && (
              <span className="absolute inset-0 -m-3 animate-pulse rounded-full bg-primary/20" />
            )}
            <button
              type="button"
              onClick={listening ? stopListening : speaking ? stopSpeaking : startListening}
              disabled={thinking}
              aria-label={listening ? "Stop listening" : "Start listening"}
              className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-glow transition active:scale-95 disabled:opacity-50 ${
                listening
                  ? "bg-destructive text-destructive-foreground"
                  : speaking
                  ? "bg-primary text-primary-foreground"
                  : "bg-gradient-hero text-primary-foreground hover:scale-105"
              }`}
            >
              {thinking ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : listening ? (
                <MicOff className="h-8 w-8" />
              ) : speaking ? (
                <Square className="h-7 w-7 fill-current" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {idle && "Tap the mic to ask a question"}
            {listening && "Listening… tap to stop"}
            {thinking && "Tutor is thinking…"}
            {speaking && "Tutor is speaking… tap to stop"}
          </p>
        </div>
      </div>
    </div>
  );
}
