import { Backdrop } from "@/components/shared/Backdrop";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { Logo } from "@/components/shared/Logo";

/** Portrait-first phone frame: compact top bar + content column. */
export function PlayerFrame({
  children,
  nickname,
  avatar,
  score,
  right,
}: {
  children: React.ReactNode;
  nickname?: string;
  avatar?: string;
  score?: number;
  right?: React.ReactNode;
}) {
  return (
    <Backdrop>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-3 safe-bottom">
        <header className="flex min-h-12 items-center justify-between gap-3">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            {nickname && avatar && (
              <span className="flex items-center gap-2 rounded-full bg-secondary/70 py-1 pr-3 pl-1">
                <AvatarBubble avatar={avatar} size="xs" />
                <span className="max-w-28 truncate text-sm font-bold">{nickname}</span>
                {score !== undefined && <span className="text-sm font-extrabold text-mango tabular-nums">{score}</span>}
              </span>
            )}
            {right}
          </div>
        </header>
        <main className="flex flex-1 flex-col py-4">{children}</main>
      </div>
    </Backdrop>
  );
}
