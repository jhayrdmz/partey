import { describe, expect, it } from "vitest";
import { LIMITS, NAME_PATTERN, cleanName, finishName } from "../../shared/constants";
import * as v from "./lib/validate";

describe("names (room names, nicknames)", () => {
  it("are capped at 30 / 12 characters", () => {
    expect(LIMITS.roomNameMax).toBe(30);
    expect(LIMITS.nicknameMax).toBe(12);
  });

  it("allow letters (any language), numbers and a single space or hyphen between words", () => {
    for (const ok of ["Ana", "Niño", "Friday Game Night", "Room 42", "José2", "StealthDev Year-end Party", "Jean-Luc"]) expect(NAME_PATTERN.test(ok)).toBe(true);
    for (const bad of ["Ana!", "x_y", "a  b", " Ana", "Ana ", "🎉 Party", "a--b", "-Ana", "Ana-", "a - b", ""]) expect(NAME_PATTERN.test(bad)).toBe(false);
  });

  it("are cleaned while typing: symbols and emoji dropped, spaces collapsed, length cut", () => {
    expect(cleanName("Ana!!", 12)).toBe("Ana");
    expect(cleanName("  Kuya   Ben 🎉", 12)).toBe("Kuya Ben ");
    expect(cleanName("Abcdefghijklmnop", 12)).toBe("Abcdefghijkl");
    expect(cleanName("Niño_123", 12)).toBe("Niño123");
    expect(cleanName("Year -- end", 30)).toBe("Year-end");
    expect(cleanName("-Ana", 12)).toBe("Ana");
    expect(finishName("Kuya Ben ")).toBe("Kuya Ben");
    expect(finishName("Year-")).toBe("Year");
    expect(NAME_PATTERN.test(finishName(cleanName("StealthDev Year-end Party", 30)))).toBe(true);
  });

  it("are enforced by the server", () => {
    expect(v.name({ n: "  Friday   Game Night " }, "n", 2, 30, "Room name")).toBe("Friday Game Night");
    expect(() => v.name({ n: "Party 🎉" }, "n", 2, 30, "Room name")).toThrow(/letters and numbers/);
    expect(v.name({ n: "StealthDev Year-end Party" }, "n", 2, 30, "Room name")).toBe("StealthDev Year-end Party");
    expect(() => v.name({ n: "a".repeat(13) }, "n", 1, 12, "Nickname")).toThrow(/at most 12/);
  });
});
