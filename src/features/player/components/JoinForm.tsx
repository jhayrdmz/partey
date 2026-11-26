import { useState } from "react";
import { Loader2, PartyPopper } from "lucide-react";
import { Link } from "react-router";
import { LIMITS, cleanName, finishName } from "@shared/constants";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { BottomBar } from "@/components/shared/BottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlayerProfile } from "@/stores/playerProfileStore";
import { AvatarPicker } from "./AvatarPicker";

export function JoinForm({
  roomCode,
  roomName,
  playerCount,
  onJoin,
  error,
}: {
  roomCode: string;
  roomName: string;
  playerCount: number;
  onJoin: (nickname: string, avatar: string) => Promise<void>;
  error: string | null;
}) {
  const profile = usePlayerProfile();
  // A nickname saved before the current rules may be too long or have symbols: clean it up.
  const [nickname, setNickname] = useState(() => cleanName(profile.nickname, LIMITS.nicknameMax));
  const [submitting, setSubmitting] = useState(false);
  const finished = finishName(nickname);
  const valid = finished.length >= LIMITS.nicknameMin;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    profile.setNickname(finished);
    try {
      await onJoin(finished, profile.avatar);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-6">
      <div className="text-center">
        <p className="text-sm font-semibold text-muted-foreground">You're joining</p>
        <h1 className="mt-1 text-3xl font-extrabold">{roomName}</h1>
        <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
          Room <span className="font-mono font-extrabold tracking-widest text-foreground">{roomCode}</span>
          <span aria-hidden>·</span> {playerCount} playing
          <Link to="/play" className="ml-1 inline-flex min-h-11 items-center font-semibold text-sky">
            Change
          </Link>
        </p>
      </div>

      <div className="flex justify-center">
        <AvatarBubble avatar={profile.avatar} size="xl" className="animate-float" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nickname">Nickname</Label>
        <Input
          id="nickname"
          autoComplete="nickname"
          enterKeyHint="go"
          placeholder="What should we call you?"
          maxLength={LIMITS.nicknameMax}
          value={nickname}
          onChange={(e) => setNickname(cleanName(e.target.value, LIMITS.nicknameMax))}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "join-error" : "nickname-hint"}
        />
        {!error && (
          <p id="nickname-hint" className="text-sm text-muted-foreground">
            Letters and numbers (a space or hyphen between words), up to {LIMITS.nicknameMax} characters.
          </p>
        )}
        {error && (
          <p id="join-error" className="text-sm font-semibold text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Avatar</Label>
        <AvatarPicker value={profile.avatar} onChange={profile.setAvatar} />
      </div>

      <div className="flex-1" />
      <BottomBar className="sm:mt-2">
        <Button type="submit" size="xl" variant="party" className="w-full" disabled={!valid || submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <PartyPopper />}
          {submitting ? "Joining…" : "Join the party"}
        </Button>
      </BottomBar>
    </form>
  );
}
