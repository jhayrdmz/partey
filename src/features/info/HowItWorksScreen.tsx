/**
 * /how-it-works: the full guide (three screens, setup, modes, every game, scoring, tips) and FAQ.
 * Follows the "How it works" artboard of the Partey design canvas. Static: no Firebase needed.
 */
import { ArrowLeft, ArrowRight, Check, ChevronDown, Crown, Lightbulb, Monitor, Repeat, Smartphone, Trophy, Tv, Users } from "lucide-react";
import { Link } from "react-router";
import { DEFAULT_OTHER_PLACEMENT_POINTS, DEFAULT_PLACEMENT_POINTS, EXPIRY, HOST_LIMITS, HOUR_MS, LIMITS, MINUTE_MS } from "@shared/constants";
import type { GameId } from "@shared/games";
import { Backdrop } from "@/components/shared/Backdrop";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { GameArt } from "@/features/games/GameArt";
import { GAME_LIST } from "@/features/games/registry";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cn } from "@/utils/cn";

const PLAYABLE = GAME_LIST.filter((g) => g.meta.playable);
const COMING_SOON = GAME_LIST.filter((g) => !g.meta.playable);

/** How each game scores (kept in step with the server handlers; see docs/ARCHITECTURE.md). */
const SCORING: Partial<Record<GameId, string>> = {
  "speed-quiz": "A correct answer scores 500, plus up to 500 more the faster you answer.",
  majority: "Pick the answer most players picked and score 500. Ties for the top spot all count.",
  "reflex-battle": "The fastest three taps score 500, 350 and 250; everyone else who taps in time scores 150. Tap before GO and you score 0.",
  impostor: "If the crew votes out the impostor, every crew member scores 500 (plus 250 if you voted for them). If the impostor survives, they score 1,000.",
  "word-scramble": "The first correct answer scores 100, then 75 and 50, and 25 for everyone after. Wrong guesses cost nothing; you can guess again every 5 seconds. The host can add a speed bonus (up to +50).",
  drawing: "Correct guessers score 100, 80, 60 and 40 in the order they get it, then 20 each. The artist earns 50 when anyone guesses right. Letters appear as hints while the clock runs.",
};

const placement = `${DEFAULT_PLACEMENT_POINTS.join(" / ")} / ${DEFAULT_OTHER_PLACEMENT_POINTS}`;

const SCREENS = [
  {
    icon: Crown,
    color: "bg-guava",
    title: "1 · Host",
    device: "Your phone or tablet",
    text: "Create a room, pick a mode and the games, then run the show from the lobby: start games, pause, skip and move on.",
    points: ["Creates the room and its 4-letter code", "Connects the big screen", "Controls every game"],
  },
  {
    icon: Tv,
    color: "bg-mango",
    title: "2 · Display",
    device: "A TV, laptop, monitor or tablet",
    text: "The big screen everyone watches. Pair it with a 6-digit code; it shows the QR code to join, every question, drawing and leaderboard.",
    points: ["Works in any modern browser", "Keeps running even if the host's phone sleeps", "Plays the music"],
  },
  {
    icon: Smartphone,
    color: "bg-calamansi",
    title: "3 · Players",
    device: "Everyone's phones",
    text: "Scan the QR code, pick a nickname and an avatar, and play right from your phone: answer, vote, draw and guess.",
    points: ["No app to install", "No account or sign-up", "Secret words and roles stay on your phone"],
  },
] as const;

const STEPS = [
  { title: "Create a room", text: "Tap Host a Game on the home page and give your party a name." },
  { title: "Pick a mode", text: "Tournament for a series of games with an overall champion, or Freestyle to play one game at a time." },
  { title: "Choose your games", text: "Pick from the library. Some games have options (time per question, rounds, categories, how many players)." },
  { title: "Connect the big screen", text: "Open joinpartey.com/display on the TV. In your lobby, tap Display and type the 6-digit code (or scan its QR)." },
  { title: "Players join", text: "Everyone scans the QR code on the big screen, or opens joinpartey.com/play and types the room code." },
  { title: "Start!", text: "Tap Start. Each game opens with a short how-to-play, then the rounds run themselves; you can pause or skip any time." },
] as const;

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do players need to install an app or make an account?",
    a: "No. Partey runs in the browser. Players scan the QR code or type the room code, pick a nickname and an avatar, and they're in.",
  },
  {
    q: "What do I need to host a party?",
    a: "A phone or tablet for you (the host), a phone for each player, and a big screen everyone can see: a smart TV, a laptop on a TV, a monitor or a tablet, with a web browser. Questions also appear on phones, but the games are made for one shared screen.",
  },
  {
    q: "How many people can play?",
    a: `Speed Quiz takes up to ${LIMITS.maxPlayersHardCap} players (the host sets the limit). The other games take up to ${LIMITS.maxPlayersPerRoom}; The Impostor and Draw & Guess default to 12 and need at least 3. Each game shows its player range in the library.`,
  },
  {
    q: "How do players join?",
    a: "Scan the QR code on the big screen with the phone's camera, or go to joinpartey.com/play and type the 4-letter room code. People can join while you're in the lobby; anyone who joins mid-game plays from the next round.",
  },
  {
    q: "How do I connect the TV?",
    a: "Open joinpartey.com/display on the TV's browser. It shows a 6-digit code and a QR code. In your lobby, tap Display, then type the code or scan the QR with your phone. The code is single-use and refreshes every few minutes, so nobody can put your room on someone else's screen.",
  },
  {
    q: "Someone's phone died or they closed the tab. Do they lose their points?",
    a: `No. They just open the same link (or the room code) on the same phone and browser, and they're back with their score. A spot is held for up to ${EXPIRY.playerGraceMs / HOUR_MS} hours.`,
  },
  {
    q: "What if the host's phone locks or the browser closes?",
    a: "The big screen keeps going on its own. Reopen Partey on the same phone and you'll see Rejoin as host on the create screen. Your room, players and scores are all still there.",
  },
  {
    q: "How long does a room stay open?",
    a: `As long as you're using it. A lobby with no activity for ${EXPIRY.waitingInactivityMs / MINUTE_MS} minutes closes on its own, and a finished tournament closes ${EXPIRY.finishedMs / MINUTE_MS} minutes after the champion is crowned. When a room ends, phones go back to the join screen and the TV back to its pairing code.`,
  },
  {
    q: "Is Partey free?",
    a: `Yes. On the free tier, the number of hosts running parties at the same time is limited (currently ${HOST_LIMITS.maxActiveHosts}), and each host can have up to ${HOST_LIMITS.maxRoomsPerHost} rooms open at once. If you hit the limit, Partey shows how to contact us for more.`,
  },
  {
    q: "Can I remove someone from the room?",
    a: "Yes. In the lobby, tap the remove icon next to their name. Removed players can't rejoin that room.",
  },
  {
    q: "Can other players see my secret word or role?",
    a: "No. In The Impostor and Draw & Guess, secret words, prompts and roles are sent only to your phone. Answers are checked on our server, and wrong guesses are never shown to anyone.",
  },
  {
    q: "There's no sound on the TV.",
    a: "Browsers block sound until the screen has been touched once. Tap or click the big screen (or press a key), and check the sound button in its bottom-right corner. The button beside it makes the display full screen.",
  },
  {
    q: "What happens to our data?",
    a: "There are no accounts. Nicknames, answers and scores belong to the room, and everything is deleted when the room ends.",
  },
];

function SectionTitle({ eyebrow, title, accent, id }: { eyebrow: string; title: string; accent?: string; id: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold tracking-[0.12em] text-guava uppercase">{eyebrow}</p>
      <h2 id={id} className="scroll-mt-8 text-3xl leading-tight font-extrabold sm:text-5xl">
        {title} {accent && <span className="text-mango">{accent}</span>}
      </h2>
    </div>
  );
}

/** FAQ as schema.org FAQPage (eligible for FAQ rich results). Built from the same list the page shows. */
const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export function HowItWorksScreen() {
  usePageMeta({
    title: "How Partey works: guide and FAQ",
    description:
      "How to host a Partey game night: create a room, connect your TV, and everyone joins on their phone with a QR code. Game modes, every game's rules and scoring, tips and FAQ.",
    path: "/how-it-works",
    jsonLd: FAQ_LD,
  });

  return (
    <Backdrop>
      <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" aria-label="Partey home" className="rounded-md outline-none focus-visible:ring-4 focus-visible:ring-ring/50">
            <Logo size="sm" />
          </Link>
          <Button asChild variant="party">
            <Link to="/host">
              Host a game <ArrowRight />
            </Link>
          </Button>
        </header>

        {/* Hero */}
        <section className="mt-12 sm:mt-20" aria-labelledby="hiw-title">
          <p className="text-sm font-bold tracking-[0.12em] text-guava uppercase">How it works</p>
          <h1 id="hiw-title" className="mt-3 text-5xl leading-[0.95] font-extrabold sm:text-7xl">
            Three screens.
            <br />
            <span className="text-mango">One party.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Partey turns any room into a game show. One host runs it, one big screen shows it, and everyone plays on their own phone. No app,
            no accounts: just scan and play.
          </p>
          <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2">
            {[
              ["#screens", "The three screens"],
              ["#setup", "Get started"],
              ["#modes", "Game modes"],
              ["#games", "The games"],
              ["#tips", "Tips"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="inline-flex min-h-10 items-center rounded-md border border-border bg-secondary/50 px-3.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/60 hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>
        </section>

        {/* Three screens */}
        <section className="mt-20 space-y-8" aria-labelledby="screens">
          <SectionTitle id="screens" eyebrow="The setup" title="Who uses" accent="which screen" />
          <div className="grid gap-4 lg:grid-cols-3">
            {SCREENS.map((s) => (
              <article key={s.title} className="flex flex-col gap-4 rounded-2xl bg-card p-6">
                <span className={cn("grid size-16 place-items-center rounded-xl", s.color, s.color === "bg-mango" ? "text-black" : "text-background")}>
                  <s.icon className="size-8" />
                </span>
                <div className="space-y-1">
                  <h3 className="text-2xl font-extrabold">{s.title}</h3>
                  <p className="text-sm font-semibold text-muted-foreground">{s.device}</p>
                </div>
                <p className="text-muted-foreground">{s.text}</p>
                <ul className="mt-auto space-y-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm font-semibold">
                      <Check className="mt-0.5 size-4 shrink-0 text-calamansi" /> {p}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="mt-20 space-y-8" aria-labelledby="setup">
          <SectionTitle id="setup" eyebrow="Get started" title="From zero to game night" accent="in six steps" />
          <ol className="grid gap-3 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4 rounded-2xl bg-card p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-lg font-extrabold text-black">{i + 1}</span>
                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold">{step.title}</h3>
                  <p className="text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Modes */}
        <section className="mt-20 space-y-8" aria-labelledby="modes">
          <SectionTitle id="modes" eyebrow="Game modes" title="Play a tournament," accent="or just play" />
          <div className="grid gap-4 md:grid-cols-2">
            <article className="space-y-3 rounded-2xl bg-card p-6">
              <span className="grid size-14 place-items-center rounded-xl bg-guava text-background">
                <Trophy className="size-7" />
              </span>
              <h3 className="text-2xl font-extrabold">Tournament</h3>
              <p className="text-muted-foreground">
                Line up several games in order. After each game, players earn placement points ({placement} for 1st, 2nd, 3rd and everyone
                else; ties share a place), and a leaderboard shows the running total. The overall champion is crowned at the end.
              </p>
            </article>
            <article className="space-y-3 rounded-2xl bg-card p-6">
              <span className="grid size-14 place-items-center rounded-xl bg-calamansi text-background">
                <Repeat className="size-7" />
              </span>
              <h3 className="text-2xl font-extrabold">Freestyle</h3>
              <p className="text-muted-foreground">
                Play one game at a time. Every game is its own competition with its own winner. Replay it, or pick another game whenever you like.
              </p>
            </article>
          </div>
        </section>

        {/* Games */}
        <section className="mt-20 space-y-8" aria-labelledby="games">
          <SectionTitle id="games" eyebrow="The lineup" title="Game night," accent="sorted." />
          <div className="grid gap-4 md:grid-cols-2">
            {PLAYABLE.map((g) => (
              <article key={g.id} className="flex flex-col overflow-hidden rounded-2xl bg-card">
                <GameArt game={g} className="aspect-video w-full rounded-none" />
                <div className="flex flex-1 flex-col gap-4 p-6">
                  <div>
                    <h3 className="text-2xl font-extrabold">{g.meta.name}</h3>
                    <p className="font-semibold text-mango">{g.meta.tagline}</p>
                  </div>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4" /> {g.meta.minPlayers}–{g.meta.maxPlayers} players
                    </span>
                    <span>About {g.meta.durationMin} min</span>
                  </p>
                  <ol className="space-y-2">
                    {g.howToPlay.map((step, i) => (
                      <li key={step} className="flex gap-3">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-extrabold">{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  {SCORING[g.id] && (
                    <p className="mt-auto rounded-xl bg-secondary/60 p-3 text-sm">
                      <span className="font-extrabold">Scoring: </span>
                      <span className="text-muted-foreground">{SCORING[g.id]}</span>
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
          {COMING_SOON.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-sky">Coming soon</p>
              <ul className="flex flex-wrap gap-2">
                {COMING_SOON.map((g) => (
                  <li key={g.id} className="rounded-md border border-border px-3.5 py-2 font-semibold text-muted-foreground">
                    {g.meta.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Tips */}
        <section className="mt-20 space-y-8" aria-labelledby="tips">
          <SectionTitle id="tips" eyebrow="Pro tips" title="For the" accent="best party" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              ["Use the biggest screen you have", "A TV or projector in full screen (the button in the display's corner) makes it a real game show."],
              ["Connect the display first", "Players can scan the QR code straight off the TV, so nobody has to type a code."],
              ["Turn the sound on", "Tap the TV once so the music can play, and make sure it isn't muted."],
              ["Keep phones charged and on Wi-Fi", "Answers are timed by our server, so a steady connection keeps it fair."],
              ["Mix it up", "Start with Speed Quiz to warm up, then The Impostor or Draw & Guess for laughs."],
              ["Pause when you need to", "The host can pause any game for snacks; everyone's timer stops."],
            ].map(([title, text]) => (
              <li key={title} className="flex gap-4 rounded-2xl bg-card p-5">
                <Lightbulb className="mt-0.5 size-6 shrink-0 text-mango" />
                <div className="space-y-1">
                  <h3 className="font-extrabold">{title}</h3>
                  <p className="text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mt-20 space-y-8" aria-labelledby="faq">
          <SectionTitle id="faq" eyebrow="FAQ" title="Questions," accent="answered" />
          <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
            {FAQ.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-lg font-bold outline-none hover:bg-secondary/40 focus-visible:bg-secondary/40 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5 text-muted-foreground">{item.a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-20 flex flex-col items-start gap-6 rounded-2xl bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="space-y-1">
            <p className="text-3xl font-extrabold">Ready? <span className="text-mango">Tara, laro!</span></p>
            <p className="text-muted-foreground">Start a room on your phone and put it on the big screen.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" variant="party">
              <Link to="/host">
                <Crown /> Host a game
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/display">
                <Monitor /> Connect a screen
              </Link>
            </Button>
          </div>
        </section>

        <footer className="mt-10">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to home
          </Link>
        </footer>
      </div>
    </Backdrop>
  );
}
