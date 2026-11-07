"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { PaperFold } from "@/components/PaperFold";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const roles = [
  { title: "Product lead, payments", why: "kept", kept: true },
  { title: "Inside sales", why: "wrong work", kept: false },
  { title: "Associate, two years under", why: "too junior", kept: false },
  { title: "Growth, another city", why: "wrong place", kept: false },
];

type SeatTone = "idle" | "bad" | "saved" | "already";

const messages: Record<Exclude<SeatTone, "idle">, string> = {
  bad: "Use a full email address.",
  saved: "Saved. We write when a desk is free.",
  already: "That address is already on the list.",
};

export function Letter({ initialSeat }: { initialSeat?: string }) {
  const root = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const [tone, setTone] = useState<SeatTone>(
    initialSeat === "saved" || initialSeat === "already" || initialSeat === "bad"
      ? initialSeat
      : "idle",
  );
  const [note, setNote] = useState(
    initialSeat === "saved" || initialSeat === "already" || initialSeat === "bad"
      ? messages[initialSeat]
      : "",
  );
  const [pending, setPending] = useState(false);
  const [motion, setMotion] = useState(false);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        setMotion(false);
        gsap.set(".strike", { scaleX: 1 });
        gsap.set(".ring", { opacity: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        setMotion(true);
        const strikes = gsap.utils.toArray<HTMLElement>(".strike");
        gsap.fromTo(
          strikes,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            stagger: 0.15,
            scrollTrigger: {
              trigger: ".roles",
              start: "top 75%",
              end: "bottom 55%",
              scrub: 0.4,
            },
          },
        );

        gsap.fromTo(
          ".ring",
          { opacity: 0, scale: 1.08 },
          {
            opacity: 1,
            scale: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: ".kept",
              start: "top 70%",
              end: "top 48%",
              scrub: 0.3,
            },
          },
        );

        const mark = root.current?.querySelector<HTMLElement>(".mark");
        const days = root.current?.querySelector<HTMLElement>(".days");
        if (mark && days) {
          gsap.fromTo(
            mark,
            { x: 0 },
            {
              x: () => days.clientWidth * 0.75,
              ease: "none",
              scrollTrigger: {
                trigger: ".beat",
                start: "top 68%",
                end: "bottom 42%",
                scrub: 0.5,
                onUpdate: (self) => {
                  progressRef.current = self.progress;
                },
              },
            },
          );
        }
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "");
    setPending(true);
    setTone("idle");
    setNote("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        already?: boolean;
      } | null;
      if (!response.ok) {
        setTone("bad");
        setNote(body?.error || messages.bad);
        return;
      }
      const next = body?.already ? "already" : "saved";
      setTone(next);
      setNote(messages[next]);
      form.reset();
    } catch {
      setTone("bad");
      setNote("Could not save. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="sheet" ref={root}>
      <div className="opening">
        <h1>The person who can hire you never sees the application.</h1>
        <form className="seat" action="/api/waitlist" method="post" onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <div className="row">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              aria-describedby="seat-note"
            />
            <button type="submit" disabled={pending}>
              {pending ? "Saving" : "Hold a seat"}
            </button>
          </div>
          <p id="seat-note" className="note" data-tone={tone} role="status">
            {note}
          </p>
        </form>
      </div>

      <section className="letter">
        <h2>Most roles are the wrong conversation.</h2>
        <ul className="roles">
          {roles.map((role) => (
            <li key={role.title} className={role.kept ? "kept" : undefined}>
              {role.kept ? <span className="ring" /> : <span className="strike" />}
              <span>{role.title}</span>
              <span className="why">{role.why}</span>
            </li>
          ))}
        </ul>

        <p className="address">
          Director of Product
          <span>A work address that verifies. A generic inbox is thrown out.</span>
        </p>

        <div className="prose">
          <p>You read the letter before it leaves your own Gmail.</p>
          <p>
            I worked the retry path on payments. The role you posted is that
            work again. I can talk this week.
          </p>
        </div>

        <div className="beat">
          <div className="track">
            <ol className="days">
              <li>Sent</li>
              <li>Quiet</li>
              <li>Nudge</li>
              <li>Answer</li>
            </ol>
            <span className="mark" />
          </div>
          {motion ? <PaperFold progressRef={progressRef} /> : null}
        </div>
      </section>
    </article>
  );
}
