import { useState } from "react";
import { ArrowRight, QrCode } from "lucide-react";
import { useNavigate } from "react-router";
import { ROOM_CODE_LENGTH } from "@shared/constants";
import { BottomBar } from "@/components/shared/BottomBar";
import { CodeInput } from "@/components/shared/CodeInput";
import { Button } from "@/components/ui/button";
import { PlayerFrame } from "../components/PlayerFrame";

export function EnterCodeScreen() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const go = (value = code) => value.length === ROOM_CODE_LENGTH && navigate(`/play/${value}`);
  return (
    <PlayerFrame>
      <form
        className="flex flex-1 flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <div className="space-y-2 pt-6 text-center">
          <h1 className="text-3xl font-extrabold">Join a game</h1>
          <p className="text-muted-foreground">Enter the room code shown on the big screen.</p>
        </div>
        <CodeInput value={code} onChange={setCode} length={ROOM_CODE_LENGTH} mode="alpha" autoFocus label="Room code" onComplete={go} />
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <QrCode className="size-4" /> Or just scan the QR code with your camera.
        </p>
        <div className="flex-1" />
        <BottomBar>
          <Button type="submit" size="xl" className="w-full" disabled={code.length !== ROOM_CODE_LENGTH}>
            Continue <ArrowRight />
          </Button>
        </BottomBar>
      </form>
    </PlayerFrame>
  );
}
