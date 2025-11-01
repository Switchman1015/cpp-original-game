import { initTerminal } from "./terminal";
import { drawAsciiMap, makeInitialState, registerCoreCommands } from "./game";

type Daily = { seed: number; modifiers?: string[] };

async function loadDaily(): Promise<Daily> {
  try {
    const res = await fetch("/daily.json");
    if (!res.ok) throw new Error("daily not found");
    return await res.json();
  } catch {
    const today = new Date();
    const seed = parseInt(`${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`);
    return { seed };
  }
}

function setBar(id: string, pct: number) {
  const el = document.getElementById(id) as HTMLElement;
  (el?.style as any).setProperty("--w", Math.max(0, Math.min(100, pct)) + "%");
  if (el) el.style.setProperty("width", pct + "%");
}

function toast(msg: string) {
  const host = document.getElementById("toasts")!;
  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = msg;
  host.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

loadDaily().then((daily) => {
  const state = makeInitialState(daily.seed, toast);
  registerCoreCommands((s) => logLine(s));

  const termApi = initTerminal(document.getElementById("terminal")!, state);
  termApi.write("Rogue Terminal: Cloudrunner — Heist mode\r\n");
  termApi.write("type 'help' to list commands.\r\n");

  const mapEl = document.getElementById("map")!;
  const creditsEl = document.getElementById("credits-val")!;

  // simple RT loop
  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(50, now - last);
    last = now;
    // regenerate some resources slowly
    state.resources.cpu = Math.min(state.resources.cpuCap, state.resources.cpu + 0.02);
    state.resources.mem = Math.min(state.resources.memCap, state.resources.mem + 0.01);
    state.resources.net = Math.min(state.resources.netCap, state.resources.net + 0.02);
    state.resources.power = Math.min(state.resources.powerCap, state.resources.power + 0.03);
    if (state.resources.heat > 0) state.resources.heat = Math.max(0, state.resources.heat - 0.02);

    // update HUD
    setBar("cpu-bar", (state.resources.cpu / state.resources.cpuCap) * 100);
    setBar("mem-bar", (state.resources.mem / state.resources.memCap) * 100);
    setBar("net-bar", (state.resources.net / state.resources.netCap) * 100);
    setBar("power-bar", (state.resources.power / state.resources.powerCap) * 100);
    setBar("heat-bar", (state.resources.heat / state.resources.heatCap) * 100);
    setBar("trace-bar", state.player.trace);
    creditsEl.textContent = String(state.player.credits);

    // events (weak windows toasts)
    const m = state.map.nodes;
    for (const id of Object.keys(m)) {
      const n = m[id];
      const t = state.scheduler.time();
      const r = (t % n.weakWindow.period);
      if (Math.abs(r - n.weakWindow.open) < 5) {
        toast(`${n.name}: 弱点窓 open`);
      }
    }

    // map draw
    mapEl.textContent = drawAsciiMap(state);
    state.scheduler.step(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function logLine(s: string) {
    termApi.write(s);
  }
});

