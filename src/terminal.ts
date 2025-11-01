import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import type { GameState } from "./game";
import { Commands } from "./game";

export type TermApi = {
  write: (s: string) => void;
  focus: () => void;
};

export function initTerminal(el: HTMLElement, state: GameState): TermApi {
  const term = new Terminal({
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: 14,
    theme: {
      background: "#0b0f14",
      foreground: "#b9d7ff",
      selection: "#21324a",
      black: "#001018",
      green: "#9cff00",
      cyan: "#00eaff",
      magenta: "#ff3fd7",
      red: "#ff3b3b",
      yellow: "#ffae00",
    },
    cursorBlink: true,
  });
  term.open(el);

  const write = (s: string) => { term.writeln(s); };
  const prompt = () => { term.write("\x1b[38;5;45mcloudrunner\x1b[0m$ "); };

  let buffer = "";
  prompt();
  term.onData((data) => {
    for (const ch of data) {
      const code = ch.charCodeAt(0);
      if (ch === "\r") {
        term.write("\r\n");
        handleLine(buffer.trim());
        buffer = "";
        prompt();
      } else if (ch === "\u007F") { // Backspace
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          term.write("\b \b");
        }
      } else if (code >= 0x20) {
        buffer += ch;
        term.write(ch);
      }
    }
  });

  function handleLine(line: string) {
    if (!line) return;
    if (line === "help") {
      write("commands: map, connect <node>, breach, scan, inject --payload <leak|burn> --stack N, firewall [up], lag, overclock, cool --power N, credits, help");
      return;
    }
    if (line === "credits") { write(`Credits: ${state.player.credits}`); return; }
    const parts = splitArgs(line);
    const cmd = parts[0];
    const args = parts.slice(1);
    const spec = Commands[cmd];
    if (!spec) { write(`unknown: ${cmd}`); return; }
    try {
      // schedule cast (delegated in game)
      spec.run({ state, args, raw: line, write });
    } catch (e:any) { write(String(e?.message||e)); }
  }

  return { write, focus: () => term.focus() };
}

function splitArgs(s: string): string[] {
  const out: string[] = [];
  let cur = ""; let inQ = false;
  for (let i=0;i<s.length;i++) {
    const c = s[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (!inQ && /\s/.test(c)) { if (cur) { out.push(cur); cur=""; } continue; }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}
