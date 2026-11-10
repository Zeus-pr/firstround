'use client';

import { useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Pile } from '@/components/Pile';
import { WaveMesh } from '@/components/wave-mesh/WaveMesh';
import { apiUrl } from '@/lib/api-url';
gsap.registerPlugin(useGSAP, ScrollTrigger);

const heroMesh = ['#f4efe6', '#1c1916', '#9d3b28'] as [string, string, string];

const headline = 'The recruiter who can hire you never sees your application.'.split(' ');

const roles = [
  { title: 'Product lead, payments', why: 'kept', kept: true },
  { title: 'Inside sales', why: 'wrong work', kept: false },
  { title: 'Associate, two years under', why: 'too junior', kept: false },
  { title: 'Growth, another city', why: 'wrong place', kept: false },
];

const addresses = [
  { line: 'careers@company.com', why: 'generic inbox', kept: false },
  { line: 'first@company.com', why: 'bounces', kept: false },
  { line: 'Director of Product', why: 'verified', kept: true },
];

const letterLines = [
  'I worked the retry path on payments.',
  'The job you posted is that work again.',
  'I can talk this week.',
];

type SeatTone = 'idle' | 'bad' | 'saved' | 'already';

const messages: Record<Exclude<SeatTone, 'idle'>, string> = {
  bad: 'Use a full email address.',
  saved: 'Saved. We will email you when a seat opens.',
  already: 'That address is already on the list.',
};

function SeatForm({
  id,
  initialNote,
  initialTone,
}: {
  id: string;
  initialNote?: string;
  initialTone?: SeatTone;
}) {
  const [tone, setTone] = useState<SeatTone>(initialTone ?? 'idle');
  const [note, setNote] = useState(initialNote ?? '');
  const [pending, setPending] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useGSAP(() => {
    const button = buttonRef.current;
    if (!button) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return;

    const onMove = (event: PointerEvent) => {
      const box = button.getBoundingClientRect();
      const x = event.clientX - (box.left + box.width / 2);
      const y = event.clientY - (box.top + box.height / 2);
      gsap.to(button, { x: x * 0.18, y: y * 0.28, duration: 0.35, ease: 'power3.out' });
    };
    const onLeave = () => {
      gsap.to(button, { x: 0, y: 0, duration: 0.5, ease: 'power3.out' });
    };
    button.addEventListener('pointermove', onMove);
    button.addEventListener('pointerleave', onLeave);
    return () => {
      button.removeEventListener('pointermove', onMove);
      button.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '');
    setPending(true);
    setTone('idle');
    setNote('');
    try {
      const response = await fetch(apiUrl('/waitlist'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        already?: boolean;
      } | null;
      if (!response.ok) {
        setTone('bad');
        setNote(body?.error || messages.bad);
        return;
      }
      const next = body?.already ? 'already' : 'saved';
      setTone(next);
      setNote(messages[next]);
      form.reset();
    } catch {
      setTone('bad');
      setNote('Could not save. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="seat" action={apiUrl('/waitlist')} method="post" onSubmit={onSubmit}>
      <label htmlFor={id}>Email</label>
      <div className="row">
        <input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          aria-describedby={`${id}-note`}
        />
        <button ref={buttonRef} type="submit" disabled={pending}>
          {pending ? 'Saving' : 'Hold a seat'}
        </button>
      </div>
      <p id={`${id}-note`} className="note" data-tone={tone} role="status">
        {note}
      </p>
    </form>
  );
}

export function Seat({
  id,
  initialNote,
  initialTone,
}: {
  id: string;
  initialNote?: string;
  initialTone?: SeatTone;
}) {
  return <SeatForm id={id} initialNote={initialNote} initialTone={initialTone} />;
}

export function Letter({ initialSeat }: { initialSeat?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const tone: SeatTone =
    initialSeat === 'saved' || initialSeat === 'already' || initialSeat === 'bad'
      ? initialSeat
      : 'idle';
  const note = tone === 'idle' ? '' : messages[tone];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      const hold = (
        trigger: string,
        distance: string,
        play: (timeline: gsap.core.Timeline) => void,
      ) => {
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger,
            start: 'top top',
            end: distance,
            pin: true,
            pinSpacing: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        play(timeline);
      };

      const reveal = (distance: string) => {
        gsap.from('.word-in', {
          y: 28,
          opacity: 0,
          duration: 0.7,
          ease: 'power3.out',
          stagger: 0.035,
        });

        hold('.sort', distance, (timeline) => {
          timeline.fromTo(
            '.roles .strike',
            { scaleX: 0 },
            { scaleX: 1, ease: 'none', stagger: 0.08 },
            0,
          );
          timeline.fromTo(
            '.roles .ring',
            { opacity: 0, scale: 1.06 },
            { opacity: 1, scale: 1, ease: 'none' },
            0.55,
          );
        });

        hold('.name', distance, (timeline) => {
          timeline.from(
            '.addresses li',
            { y: 20, opacity: 0, stagger: 0.06, ease: 'power2.out' },
            0,
          );
          timeline.fromTo(
            '.addresses .strike',
            { scaleX: 0 },
            { scaleX: 1, ease: 'none', stagger: 0.08 },
            0.28,
          );
          timeline.fromTo('.addresses .ring', { opacity: 0 }, { opacity: 1, ease: 'none' }, 0.72);
        });

        hold('.write', distance, (timeline) => {
          timeline.fromTo(
            '.letter-line',
            { filter: 'blur(10px)', y: 22, opacity: 0.15 },
            { filter: 'blur(0px)', y: 0, opacity: 1, ease: 'none', stagger: 0.08 },
          );
        });

        const pile = gsap.timeline({
          scrollTrigger: {
            trigger: '.stage',
            start: 'top top',
            end: '+=180%',
            pin: true,
            pinSpacing: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              progressRef.current = self.progress;
            },
          },
        });
        pile.fromTo(
          '.stage-problem',
          { opacity: 1, y: 0 },
          { opacity: 0, y: -16, ease: 'none' },
          0,
        );
        pile.fromTo(
          '.stage-solution',
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, ease: 'none' },
          0.45,
        );

        hold('.reply', distance, (timeline) => {
          timeline.from(
            '.reply-line',
            { filter: 'blur(8px)', y: 16, opacity: 0, stagger: 0.08, ease: 'power2.out' },
            0,
          );
        });
      };

      mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
        reveal('+=150%');
      });

      mm.add('(max-width: 899px) and (prefers-reduced-motion: no-preference)', () => {
        reveal('+=120%');
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        progressRef.current = 1;
        gsap.set('.stage-problem', { opacity: 0 });
        gsap.set('.stage-solution', { opacity: 1, y: 0 });
        gsap.set('.strike', { scaleX: 1 });
        gsap.set('.ring', { opacity: 1 });
        gsap.set('.word-in, .letter-line, .reply-line, .addresses li', {
          opacity: 1,
          y: 0,
          filter: 'none',
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root}>
      <article className="sheet">
        <WaveMesh colors={heroMesh} crests className="opening">
          <h1>
            {headline.map((word, index) => (
              <span className="word-in" key={`${word}-${index}`}>
                {word}
              </span>
            ))}
          </h1>
          <p className="problem">
            A hundred people apply before you finish the job post. Yours stays in the pile.
          </p>
          <SeatForm id="email" initialNote={note} initialTone={tone} />
        </WaveMesh>

        <section className="route-story" aria-labelledby="route-heading">
          <div className="route-intro">
            <h2 id="route-heading">We skip the queue.</h2>
            <p>
              One open job. One recruiter or hiring manager. An email you approve before it sends
              from your Gmail.
            </p>
          </div>

          <div className="route-map">
            <svg
              className="route-desktop"
              viewBox="0 0 1200 470"
              role="img"
              aria-labelledby="route-map-title route-map-description"
            >
              <title id="route-map-title">Two paths from one resume</title>
              <desc id="route-map-description">
                A resume branches into two paths. The usual application passes through an applicant
                tracking system, recruiter queue, and application pile. First Round matches the
                resume to a job and emails the recruiter or hiring manager.
              </desc>

              <path className="route-trunk" d="M145 226 H225" />
              <path
                className="route-branch route-branch-ours"
                d="M225 226 C285 226 275 120 345 120 H1028"
              />
              <path
                className="route-branch route-branch-usual"
                d="M225 226 C285 226 275 347 345 347 H1004"
              />
              <path
                className="route-branch-flow route-branch-flow-ours"
                d="M225 226 C285 226 275 120 345 120 H1028"
              />
              <path
                className="route-branch-flow route-branch-flow-usual"
                d="M225 226 C285 226 275 347 345 347 H1004"
              />

              <g className="route-origin" transform="translate(100 226)">
                <circle r="42" />
                <path d="M-11 -9h22v27h-22z M-6 -15h17v6 M-6 -2h12 M-6 4h12" />
                <text y="66" textAnchor="middle">
                  YOUR RESUME
                </text>
              </g>
              <circle className="route-split" cx="225" cy="226" r="5" />

              <image
                className="route-brand-logo"
                href="/brand/firstround-logo-ink.svg"
                x="579"
                y="56"
                width="112"
                height="26"
                preserveAspectRatio="xMidYMid meet"
              />
              <text
                className="route-lane-label route-lane-usual"
                x="635"
                y="294"
                textAnchor="middle"
              >
                TYPICAL APPLICATION
              </text>

              <g className="route-step route-step-ours" transform="translate(700 120)">
                <circle r="16" />
                <path className="route-step-icon" d="M-6 -2h12v8h-12z M-2 -2v-3h4v3 M-6 1h12" />
                <text className="route-step-title" y="45" textAnchor="middle">
                  Right job
                </text>
              </g>

              <g className="route-destination" transform="translate(1060 120)">
                <circle className="route-destination-ring" r="32" />
                <circle className="route-destination-core" r="25" />
                <path
                  className="route-destination-person"
                  d="M-8 7c1-8 15-8 16 0M0-3a5 5 0 1 0 0-10 5 5 0 0 0 0 10M-4 3l4 4 4-4"
                />
                <text className="route-destination-label" y="56" textAnchor="middle">
                  RECRUITING HEAD
                </text>
              </g>

              <g className="route-step route-step-usual" transform="translate(410 347)">
                <circle r="16" />
                <text className="route-step-index" y="4" textAnchor="middle">
                  01
                </text>
                <text className="route-step-title" y="45" textAnchor="middle">
                  ATS filter
                </text>
                <text className="route-step-note" y="63" textAnchor="middle">
                  keyword match
                </text>
              </g>
              <g className="route-step route-step-usual" transform="translate(635 347)">
                <circle r="16" />
                <text className="route-step-index" y="4" textAnchor="middle">
                  02
                </text>
                <text className="route-step-title" y="45" textAnchor="middle">
                  Recruiter
                </text>
                <text className="route-step-note" y="63" textAnchor="middle">
                  one of hundreds
                </text>
              </g>
              <g className="route-step route-step-usual" transform="translate(855 347)">
                <circle r="16" />
                <text className="route-step-index" y="4" textAnchor="middle">
                  03
                </text>
                <text className="route-step-title" y="45" textAnchor="middle">
                  Application pile
                </text>
                <text className="route-step-note" y="63" textAnchor="middle">
                  page 47 of 63
                </text>
              </g>
              <g className="route-no-reply" transform="translate(1060 347)">
                <circle r="26" />
                <path d="M-8 -8l16 16M8 -8L-8 8" />
                <text y="49" textAnchor="middle">
                  NO REPLY
                </text>
              </g>

              <g className="route-packet route-packet-ours">
                <rect x="-8" y="-10" width="16" height="20" rx="1" />
                <path d="M-4 -4h8M-4 0h8M-4 4h5" />
                <animateMotion
                  id="routeOursMotionDesktop"
                  dur="6.8s"
                  repeatCount="indefinite"
                  path="M225 226 C285 226 275 120 345 120 H1028"
                />
              </g>
              <g className="route-packet route-packet-usual">
                <rect x="-8" y="-10" width="16" height="20" rx="1" />
                <path d="M-4 -4h8M-4 0h8M-4 4h5" />
                <animateMotion
                  dur="10s"
                  repeatCount="indefinite"
                  path="M225 226 C285 226 275 347 345 347 H1004"
                />
              </g>
              <g className="route-packet route-packet-usual route-packet-lag">
                <rect x="-8" y="-10" width="16" height="20" rx="1" />
                <path d="M-4 -4h8M-4 0h8M-4 4h5" />
                <animateMotion
                  dur="10s"
                  begin="3.5s"
                  repeatCount="indefinite"
                  path="M225 226 C285 226 275 347 345 347 H1004"
                />
              </g>
            </svg>

            <svg
              className="route-mobile"
              viewBox="0 0 420 760"
              role="img"
              aria-label="Two paths from one resume"
            >
              <path className="route-mobile-trunk" d="M210 96v58" />
              <path
                className="route-mobile-branch route-mobile-branch-ours"
                d="M210 154 C210 190 105 182 105 230 V615"
              />
              <path
                className="route-mobile-branch route-mobile-branch-usual"
                d="M210 154 C210 190 315 182 315 230 V636"
              />
              <path
                className="route-mobile-branch-flow route-mobile-branch-flow-ours"
                d="M210 154 C210 190 105 182 105 230 V615"
              />
              <path
                className="route-mobile-branch-flow route-mobile-branch-flow-usual"
                d="M210 154 C210 190 315 182 315 230 V636"
              />

              <g className="route-mobile-origin" transform="translate(210 63)">
                <circle r="31" />
                <path d="M-8 -8h16v20h-16z M-4 -12h12v4 M-4 -2h9 M-4 3h9" />
              </g>
              <text className="route-mobile-origin-label" x="210" y="113" textAnchor="middle">
                YOUR RESUME
              </text>
              <circle className="route-mobile-split" cx="210" cy="154" r="5" />

              <rect className="route-mobile-logo-backdrop" x="62" y="194" width="86" height="24" />
              <image
                className="route-mobile-brand-logo"
                href="/brand/firstround-logo-ink.svg"
                x="68"
                y="197"
                width="74"
                height="17"
                preserveAspectRatio="xMidYMid meet"
              />
              <text
                className="route-mobile-lane route-mobile-lane-usual"
                x="315"
                y="211"
                textAnchor="middle"
              >
                TYPICAL
              </text>

              <g
                className="route-mobile-step route-mobile-step-ours"
                transform="translate(105 423)"
              >
                <circle r="15" />
                <path className="route-step-icon" d="M-6 -2h12v8h-12z M-2 -2v-3h4v3 M-6 1h12" />
                <text className="route-mobile-step-title" y="38" textAnchor="middle">
                  Right job
                </text>
              </g>
              <g className="route-mobile-destination" transform="translate(105 636)">
                <circle className="route-mobile-destination-ring" r="21" />
                <path
                  className="route-mobile-destination-person"
                  d="M-7 5c1-7 13-7 14 0M0-4a4 4 0 1 0 0-8 4 4 0 0 0 0 8M-3 2l3 3 3-3"
                />
                <text className="route-mobile-destination-label" y="38" textAnchor="middle">
                  RECRUITING HEAD
                </text>
              </g>

              <g
                className="route-mobile-step route-mobile-step-usual"
                transform="translate(315 285)"
              >
                <circle r="15" />
                <text y="4" textAnchor="middle">
                  01
                </text>
                <text className="route-mobile-step-title" y="38" textAnchor="middle">
                  ATS filter
                </text>
                <text className="route-mobile-step-note" y="54" textAnchor="middle">
                  keywords
                </text>
              </g>
              <g
                className="route-mobile-step route-mobile-step-usual"
                transform="translate(315 405)"
              >
                <circle r="15" />
                <text y="4" textAnchor="middle">
                  02
                </text>
                <text className="route-mobile-step-title" y="38" textAnchor="middle">
                  Recruiter
                </text>
                <text className="route-mobile-step-note" y="54" textAnchor="middle">
                  long queue
                </text>
              </g>
              <g
                className="route-mobile-step route-mobile-step-usual"
                transform="translate(315 525)"
              >
                <circle r="15" />
                <text y="4" textAnchor="middle">
                  03
                </text>
                <text className="route-mobile-step-title" y="38" textAnchor="middle">
                  Application
                </text>
                <text className="route-mobile-step-note" y="54" textAnchor="middle">
                  pile
                </text>
              </g>
              <g className="route-mobile-no-reply" transform="translate(315 636)">
                <circle r="17" />
                <path d="M-6 -6l12 12M6 -6L-6 6" />
                <text y="34" textAnchor="middle">
                  NO REPLY
                </text>
              </g>

              <g className="route-packet route-packet-ours">
                <rect x="-7" y="-9" width="14" height="18" rx="1" />
                <path d="M-3 -3h6M-3 1h6" />
                <animateMotion
                  id="routeOursMotionMobile"
                  dur="6.8s"
                  repeatCount="indefinite"
                  path="M210 154 C210 190 105 182 105 230 V615"
                />
              </g>
              <g className="route-packet route-packet-usual">
                <rect x="-7" y="-9" width="14" height="18" rx="1" />
                <path d="M-3 -3h6M-3 1h6" />
                <animateMotion
                  dur="10s"
                  repeatCount="indefinite"
                  path="M210 154 C210 190 315 182 315 230 V636"
                />
              </g>
              <g className="route-packet route-packet-usual route-packet-lag">
                <rect x="-7" y="-9" width="14" height="18" rx="1" />
                <path d="M-3 -3h6M-3 1h6" />
                <animateMotion
                  dur="10s"
                  begin="3.5s"
                  repeatCount="indefinite"
                  path="M210 154 C210 190 315 182 315 230 V636"
                />
              </g>
            </svg>
          </div>
        </section>

        <section className="chapter sort" id="sort">
          <h2>Most jobs are the wrong conversation.</h2>
          <ul className="roles">
            {roles.map((role) => (
              <li key={role.title} className={role.kept ? 'kept' : undefined}>
                {role.kept ? <span className="ring" /> : null}
                <span className="role-title">
                  {role.title}
                  {role.kept ? null : <span className="strike" />}
                </span>
                <span className="why">{role.why}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="chapter name" id="name">
          <h2>One person owns the job.</h2>
          <ul className="addresses">
            {addresses.map((item) => (
              <li key={item.line} className={item.kept ? 'kept' : undefined}>
                {item.kept ? <span className="ring" /> : null}
                <span className="role-title">
                  {item.line}
                  {item.kept ? null : <span className="strike" />}
                </span>
                <span className="why">{item.why}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="chapter write" id="letter">
          <h2>You approve the email before it sends.</h2>
          <div className="letter-lines">
            {letterLines.map((line) => (
              <p className="letter-line" key={line}>
                {line}
              </p>
            ))}
          </div>
        </section>
      </article>

      <section className="stage" aria-label="The pile, then one email">
        <Pile progressRef={progressRef} />
        <div className="stage-caption">
          <p className="stage-problem">A hundred applications. Yours is buried in them.</p>
          <p className="stage-solution">One email reaches the recruiter or hiring manager.</p>
        </div>
      </section>

      <article className="sheet reply" id="reply">
        <h2 className="reply-line">They write back.</h2>
        <p className="reply-line reply-body">
          Forwarded to the person who owns the job. Thursday works.
        </p>
        <p className="reply-line reply-close">Your only job is the call.</p>
        <SeatForm id="email-end" />
      </article>
    </div>
  );
}
