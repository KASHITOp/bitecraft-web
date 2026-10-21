"use client";

import { useEffect, useRef, useState } from "react";
import { ChefRecipeCard } from "@/components/ChefRecipeCard";
import { Icon } from "@/components/Icon";
import { RecipeCard } from "@/components/RecipeCard";
import { matchRecipes, parseIngredients, type ChefMatch } from "@/lib/chef";
import type { ChefRequest, ChefResponse } from "@/lib/chef-api";
import { ING, INGREDIENTS, RECIPE, RECIPES } from "@/lib/data";
import { useMyGear, useTargets } from "@/lib/hooks";
import { useChat, usePantry, useProfile, type ChatMessage } from "@/lib/state";

const SUGGESTIONS = ["2 eggs, half onion, bread, cheese slice", "Maggi and one tomato", "Poha, peanuts, a lemon", "Paneer, capsicum, curd"];

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

class NoServer extends Error {}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function isChefResponse(v: unknown): v is ChefResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.matches) || typeof o.reply !== "string") return false;
  if (o.kind === "fallback") return typeof o.note === "string";
  if (o.kind === "recipe") {
    const r = o.recipe as Record<string, unknown> | undefined;
    return !!r && typeof r.title === "string" && Array.isArray(r.steps) && Array.isArray(r.ingredients);
  }
  return false;
}

export function Chef() {
  const [chat, setChat] = useChat();
  const [pantry] = usePantry();
  const [profile] = useProfile();
  const gear = useMyGear();
  const t = useTargets();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.length, busy]);

  const localFallback = (message: string, usePantry: boolean, note: string): ChatMessage => {
    const ids = [...new Set([...parseIngredients(message, INGREDIENTS), ...(usePantry ? pantry.map((p) => p.id) : [])])];
    const matches = matchRecipes(ids, RECIPES, { gear, tier: profile?.tier, limit: 5 });
    return {
      id: newId(),
      role: "chef",
      text: matches.length
        ? "Here's what the recipe book says you can make with that."
        : "I couldn't spot anything I know in that. Try plain ingredient names, like '2 eggs, onion, bread'.",
      note,
      matches,
    };
  };

  const send = async (raw: string, usePantry = false) => {
    const message = raw.trim();
    if ((!message && !usePantry) || busy) return;
    const shown = usePantry
      ? `Use my pantry${message ? `, plus ${message}` : ""}: ${pantry.map((p) => ING.get(p.id)?.name).filter(Boolean).join(", ") || "(empty)"}`
      : message;
    setChat((prev) => [...prev, { id: newId(), role: "user", text: shown }]);
    setText("");
    setBusy(true);

    const body: ChefRequest = {
      message,
      usePantry,
      pantry: pantry.map((p) => p.id),
      profile: profile
        ? { gear: profile.gear, tier: profile.tier, goal: profile.goal, kcal: t?.kcal, protein: t?.protein }
        : { gear, tier: "balanced" },
    };

    let reply: ChatMessage;
    try {
      // The Android app has no server of its own: it calls a deployed BiteCraft if
      // NEXT_PUBLIC_API_BASE was set at build time, otherwise it answers locally.
      if (process.env.NEXT_PUBLIC_MOBILE === "1" && !API_BASE) throw new NoServer();
      const res = await fetch(`${API_BASE}/api/chef`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json();
      if (!isChefResponse(data)) throw new Error("bad shape");
      reply =
        data.kind === "recipe"
          ? { id: newId(), role: "chef", text: data.reply, recipe: { ...data.recipe, id: newId() }, matches: data.matches }
          : { id: newId(), role: "chef", text: data.reply, note: data.note, matches: data.matches };
    } catch (err) {
      reply = localFallback(
        message,
        usePantry,
        err instanceof NoServer
          ? "These come from the recipe book on your phone. The AI Chef is in the web version."
          : typeof navigator !== "undefined" && !navigator.onLine
            ? "You're offline, so these come from the recipe book on your phone."
            : "Couldn't reach the Chef just now, so these come from the recipe book on your phone.",
      );
    }
    setChat((prev) => [...prev, reply]);
    setBusy(false);
  };

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <div className="px-4 pb-2 pt-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Fridge Raid Chef</h1>
          {chat.length > 0 && (
            <button type="button" className="tap -mt-2 text-sm font-semibold underline underline-offset-4" onClick={() => setChat([])}>
              Clear chat
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          Tell me what&apos;s lying around. I&apos;ll only use gear you own: {gear.length ? gear.join(", ") : "none, so no-cook"}.
        </p>
      </div>

      <div className="flex-1 space-y-4 px-4 pb-4" aria-live="polite" data-testid="chat-log">
        {chat.length === 0 && (
          <div className="rounded-md border border-dashed border-rule-strong px-3 py-3">
            <p className="font-semibold">Try something like:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.map((m) => (m.role === "user" ? <UserBubble key={m.id} text={m.text} /> : <ChefReply key={m.id} m={m} />))}
        {busy && (
          <p className="label flex items-center gap-2" role="status">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            Chef is checking the shelves…
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-16 z-20 border-t border-rule bg-bg px-4 pb-3 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <button
          type="button"
          className="chip mb-2"
          onClick={() => send(text, true)}
          disabled={busy || pantry.length === 0}
          title={pantry.length === 0 ? "Your pantry is empty" : undefined}
          data-testid="use-pantry"
        >
          <Icon name="jar" size={18} />
          Use my pantry
          {pantry.length > 0 && <span className="num text-xs font-normal">({pantry.length})</span>}
        </button>
        <div className="flex gap-2">
          <label htmlFor="chef-input" className="sr-only">
            What do you have?
          </label>
          <input
            id="chef-input"
            className="field"
            placeholder="2 eggs, half onion, bread…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button type="submit" className="btn btn-primary shrink-0 px-4" disabled={busy || !text.trim()} aria-label="Ask the Chef">
            <Icon name="send" size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-md border border-rule-strong bg-surface-2 px-3 py-2">{text}</p>
    </div>
  );
}

function ChefReply({ m }: { m: ChatMessage }) {
  return (
    <div className="space-y-2.5" data-testid="chef-reply">
      <p className="label">Chef</p>
      <p className="text-[1.02rem] leading-relaxed">{m.text}</p>
      {m.note && (
        <p className="text-sm text-muted" data-testid="chef-note">
          {m.note}
        </p>
      )}
      {m.recipe && <ChefRecipeCard recipe={m.recipe} />}
      {!m.recipe && m.matches && m.matches.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="chef-matches">
          {m.matches.map((x) => (
            <MatchRow key={x.id} match={x} />
          ))}
        </ul>
      )}
      {m.recipe && m.matches && m.matches.filter((x) => x.id !== m.recipe?.fromLibraryId).length > 0 && (
        <details className="text-sm">
          <summary className="tap flex cursor-pointer items-center font-semibold">Other close matches from the book</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {m.matches
              .filter((x) => x.id !== m.recipe?.fromLibraryId)
              .map((x) => (
                <MatchRow key={x.id} match={x} />
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function MatchRow({ match }: { match: ChefMatch }) {
  const r = RECIPE.get(match.id);
  if (!r) return null;
  return (
    <li>
      <RecipeCard recipe={r} />
      <p className="mt-1 text-xs text-muted">
        Uses <span className="num">{match.have}</span> thing{match.have === 1 ? "" : "s"} you have
        {match.missing > 0 ? (
          <>
            , needs <span className="num">{match.missing}</span> more
          </>
        ) : (
          ", nothing else to buy"
        )}
        .
      </p>
    </li>
  );
}

