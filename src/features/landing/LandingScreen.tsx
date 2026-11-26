import { CircleHelp, ArrowRight, Crown, MonitorPlay, Smartphone, Tv, Users } from "lucide-react";
import { motion } from "motion/react";
import { LIMITS } from "@shared/constants";
import { Link } from "react-router";
import { Backdrop } from "@/components/shared/Backdrop";
import { Logo } from "@/components/shared/Logo";
import { GAME_LIST } from "@/features/games/registry";
import { cn } from "@/utils/cn";

interface RoleCardProps {
  to: string;
  icon: React.ElementType;
  title: string;
  description: string;
  cta: string;
  accent: "primary" | "accent";
  delay: number;
}

function RoleCard({ to, icon: Icon, title, description, cta, accent, delay }: RoleCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: "spring", stiffness: 140, damping: 18 }}>
      <Link
        to={to}
        className={cn(
          "group relative flex h-full flex-col gap-4 overflow-hidden rounded-3xl border-2 p-6 transition-all outline-none sm:p-8",
          "glass hover:-translate-y-1 focus-visible:ring-4 focus-visible:ring-ring/50 active:scale-[0.99]",
          // The border is a darker shade of the card's own surface (#221d45), not an accent colour.
          "border-[#17132f]",
        )}
      >
        <span
          className={cn(
            "grid size-14 place-items-center rounded-2xl sm:size-16",
            accent === "primary" ? "bg-mango text-black" : "bg-guava text-background",
          )}
        >
          <Icon className="size-7 sm:size-8" />
        </span>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold sm:text-3xl">{title}</h2>
          <p className="text-base text-muted-foreground sm:text-lg">{description}</p>
        </div>
        <span
          className={cn(
            "mt-auto inline-flex items-center gap-2 pt-2 text-lg font-bold",
            accent === "primary" ? "text-mango" : "text-guava",
          )}
        >
          {cta} <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
        </span>
      </Link>
    </motion.div>
  );
}

export function LandingScreen() {
  return (
    <Backdrop>
      <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-10 pb-8 sm:px-6 sm:pt-16 lg:justify-center">
        <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 sm:mb-12">
          <div className="flex items-start justify-between gap-4">
            <Logo size="lg" tagline />
            {/* Centred on the wordmark line (48px, 60px from sm), not on wordmark + tagline. */}
            <nav aria-label="Site" className="mt-0.5 shrink-0 sm:mt-2">
              <Link
                to="/how-it-works"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-secondary/50 px-3.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
              >
                <CircleHelp className="size-4 text-mango" /> How it works
              </Link>
            </nav>
          </div>
          <p className="mt-5 max-w-xl text-lg text-foreground/80 sm:text-xl">
            Party games on the big screen, played on your phone. Gather the barkada, pick your games, and battle for the crown.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2 text-sm font-semibold text-muted-foreground">
            <li className="inline-flex items-center gap-1.5 rounded-md bg-secondary/70 px-3 py-1.5"><Users className="size-4 text-mango" /> Up to {LIMITS.maxPlayersHardCap} players</li>
            <li className="inline-flex items-center gap-1.5 rounded-md bg-secondary/70 px-3 py-1.5"><Smartphone className="size-4 text-calamansi" /> No app or account</li>
            <li className="inline-flex items-center gap-1.5 rounded-md bg-secondary/70 px-3 py-1.5"><Crown className="size-4 text-guava" /> {GAME_LIST.length} games</li>
          </ul>
        </motion.header>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          <RoleCard
            to="/host"
            icon={Crown}
            title="Host a Game"
            description="Create a room, invite friends, and manage the games."
            cta="Create a room"
            accent="primary"
            delay={0.05}
          />
          <RoleCard
            to="/display"
            icon={Tv}
            title="Game Display"
            description="Connect a TV or another screen to an existing game room."
            cta="Connect a screen"
            accent="accent"
            delay={0.12}
          />
        </div>

        <footer className="mt-10 flex flex-col items-start gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <MonitorPlay className="size-4" /> Joining as a player? Scan the QR code on the game screen.
          </span>
          <Link to="/play" className="inline-flex min-h-11 items-center font-semibold text-sky underline-offset-4 hover:underline">
            Enter a room code instead
          </Link>
        </footer>
      </main>
    </Backdrop>
  );
}
