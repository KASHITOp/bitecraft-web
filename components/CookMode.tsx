"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { keepAwake, timerBuzz } from "@/lib/native";

export interface CookStep {
  text: string;
  timer?: number;
}

interface TimerState {
  step: number;
  total: number;
  remaining: number;
  endAt: number | null;
  finished: boolean;
}

/** Full-screen, one-step-at-a-time cooking view with timers and wake lock. */
export function CookMode({
  title,
  steps,
  tip,
  backHref,
}: {
  title: string;
  steps: CookStep[];
  tip?: { text: string; beforeStep: number };
  backHref: string;
}) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const [finishedAll, setFinishedAll] = useState(false);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const wakeOn = useWakeLock();
  const audio = useRef<AudioContext | null>(null);

  const step = steps[idx];

  const ring = useCallback(() => {
    // Capacitor Haptics inside the Android app, the Vibration API on the web.
    void timerBuzz().then((native) => {
      if (native) return;
      try {
        navigator.vibrate?.([400, 200, 400, 200, 600]);
      } catch {
        /* not supported */
      }
    });
    const ctx = audio.current;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.5 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.5 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + i * 0.5);
      osc.stop(t0 + i * 0.5 + 0.4);
    }
  }, []);

  const endAt = timer && !timer.finished ? timer.endAt : null;
  useEffect(() => {
    if (!endAt) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endAt) {
        window.clearInterval(id);
        ring();
        setTimer((cur) => (cur && cur.endAt === endAt ? { ...cur, finished: true, endAt: null, remaining: 0 } : cur));
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [endAt, ring]);

  const remaining = timer ? (timer.endAt ? Math.max(0, timer.endAt - now) : timer.remaining) : 0;

  const startTimer = (stepIndex: number, seconds: number) => {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC && !audio.current) audio.current = new AC();
      void audio.current?.resume();
    } catch {
      /* audio blocked */
    }
    const base = timer && timer.step === stepIndex && !timer.finished ? timer.remaining : seconds * 1000;
    const t = Date.now();
    setNow(t);
    setTimer({ step: stepIndex, total: seconds * 1000, remaining: base, endAt: t + base, finished: false });
  };

  const pauseTimer = () => setTimer((t) => (t && t.endAt ? { ...t, remaining: Math.max(0, t.endAt - Date.now()), endAt: null } : t));
  const resetTimer = () => setTimer(null);

  const completeStep = () => {
    setDone((d) => new Set(d).add(idx));
    if (idx < steps.length - 1) setIdx(idx + 1);
    else setFinishedAll(true);
  };

  if (finishedAll) {
    return (
      <Shell title={title} backHref={backHref} idx={steps.length - 1} total={steps.length} done={done}>
        <div className="flex flex-1 flex-col justify-center">
          <p className="label">All steps done</p>
          <h2 className="mt-2 text-4xl font-bold leading-tight">Cooked. Eat it hot.</h2>
          <p className="mt-3 text-lg text-muted">Wash the pan now while it&apos;s warm. Future you will thank you.</p>
        </div>
        <div className="flex flex-col gap-3 pb-[env(safe-area-inset-bottom)]">
          <Link href={backHref} className="btn btn-primary w-full text-lg">
            Back to the recipe
          </Link>
          <button type="button" className="btn btn-ghost w-full" onClick={() => setFinishedAll(false)}>
            Look at the steps again
          </button>
        </div>
      </Shell>
    );
  }

  const timerHere = timer && timer.step === idx;
  const elsewhere = timer && timer.step !== idx && (timer.endAt || timer.finished);

  return (
    <Shell title={title} backHref={backHref} idx={idx} total={steps.length} done={done}>
      {elsewhere && (
        <button
          type="button"
          onClick={() => setIdx(timer!.step)}
          className={`mb-3 flex min-h-12 items-center justify-between rounded-md px-3 text-sm font-semibold ${
            timer!.finished ? "bg-chilli text-white" : "bg-accent-soft"
          }`}
        >
          <span>
            {timer!.finished ? "Timer done" : "Timer running"} on step <span className="num">{timer!.step + 1}</span>
          </span>
          <span className="num text-base">{fmt(remaining)}</span>
        </button>
      )}

      <div className="flex-1 overflow-y-auto">
        {tip && tip.beforeStep === idx && (
          <aside className="mb-4 rounded-md border-l-4 border-chilli bg-chilli-soft px-4 py-3" data-testid="cook-tip">
            <p className="text-xs font-bold uppercase tracking-wider text-chilli">Before this step: where it goes wrong</p>
            <p className="mt-1 text-lg leading-snug">{tip.text}</p>
          </aside>
        )}
        <p className="label">
          Step <span className="num">{idx + 1}</span>
        </p>
        <p className="mt-2 text-[1.65rem] font-semibold leading-snug" data-testid="cook-step">
          {step.text}
        </p>

        {step.timer && (
          <div
            className={`mt-6 rounded-md border-[1.5px] p-4 ${timerHere && timer!.finished ? "border-chilli bg-chilli-soft" : "border-ink bg-surface"}`}
            data-testid="timer"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold">
                <Icon name="timer" size={22} />
                {timerHere && timer!.finished ? <span role="alert">Time&apos;s up</span> : "Timer"}
              </span>
              <span className="num text-5xl font-bold" data-testid="timer-display" aria-live="polite">
                {fmt(timerHere ? remaining : step.timer * 1000)}
              </span>
            </div>
            {timerHere && (
              <div className="meter mt-3" aria-hidden>
                <span style={{ width: `${100 - Math.round((remaining / timer!.total) * 100)}%`, background: "var(--accent)" }} />
              </div>
            )}
            <div className="mt-4 flex gap-2">
              {!timerHere || (!timer!.endAt && !timer!.finished) ? (
                <button type="button" className="btn btn-primary flex-1" onClick={() => startTimer(idx, step.timer!)} data-testid="timer-start">
                  <Icon name="play" size={20} />
                  {timerHere ? "Resume" : `Start ${Math.round(step.timer / 60)} min timer`}
                </button>
              ) : timer!.finished ? (
                <button type="button" className="btn flex-1" onClick={resetTimer} data-testid="timer-dismiss">
                  Stop and reset
                </button>
              ) : (
                <button type="button" className="btn flex-1" onClick={pauseTimer} data-testid="timer-pause">
                  <Icon name="pause" size={20} />
                  Pause
                </button>
              )}
              {timerHere && !timer!.finished && (
                <button type="button" className="btn btn-ghost" onClick={resetTimer}>
                  Reset
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-3 pb-[env(safe-area-inset-bottom)]">
        <button type="button" className="btn btn-ghost" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
          <Icon name="back" size={20} />
          <span className="sr-only">Previous step</span>
        </button>
        <button type="button" className="btn btn-primary min-h-16 flex-1 text-lg" onClick={completeStep} data-testid="step-done">
          <Icon name="check" size={22} strokeWidth={2.5} />
          {idx < steps.length - 1 ? "Done, next step" : "Done, finish"}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">{wakeOn ? "Screen stays on while you cook." : "Tip: keep your screen awake."}</p>
    </Shell>
  );
}

function Shell({
  title,
  backHref,
  idx,
  total,
  done,
  children,
}: {
  title: string;
  backHref: string;
  idx: number;
  total: number;
  done: Set<number>;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-bg px-4 pb-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
      <div className="flex items-center gap-2">
        <Link href={backHref} className="tap -ml-2 flex items-center justify-center" aria-label="Close cook mode">
          <Icon name="x" size={26} />
        </Link>
        <p className="flex-1 truncate font-semibold">{title}</p>
        <p className="num text-sm text-muted">
          {idx + 1}/{total}
        </p>
      </div>
      <div className="mt-2 mb-5 flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${done.has(i) ? "bg-ink" : i === idx ? "bg-accent" : "bg-rule"}`} />
        ))}
      </div>
      {children}
    </div>
  );
}

function fmt(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Keep the screen on while cooking: Capacitor keep-awake in the app, the Wake Lock API on the web. */
function useWakeLock(): boolean {
  const [on, setOn] = useState(false);
  const [native, setNative] = useState(false);
  useEffect(() => {
    let active = true;
    void keepAwake(true).then((ok) => {
      if (active && ok) setNative(true);
    });
    return () => {
      active = false;
      void keepAwake(false);
    };
  }, []);
  useEffect(() => {
    type Sentinel = { release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };
    if (!nav.wakeLock) return;
    let sentinel: Sentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const s = await nav.wakeLock!.request("screen");
        if (cancelled) {
          void s.release();
          return;
        }
        sentinel = s;
        setOn(true);
        s.addEventListener("release", () => setOn(false));
      } catch {
        setOn(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
    };
  }, []);
  return on || native;
}
