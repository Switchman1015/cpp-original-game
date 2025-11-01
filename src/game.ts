import { Scheduler } from "./scheduler";

export type Resources = {
  cpu: number; mem: number; net: number; power: number; heat: number;
  cpuCap: number; memCap: number; netCap: number; powerCap: number; heatCap: number;
};

export type Player = {
  hp: number;
  shield: number;
  credits: number;
  trace: number; // 0-100
  gcdUntil: number; // ms timestamp
};

export type Node = {
  id: string;
  name: string;
  kind: "normal"|"vault"|"shop"|"event"|"rest"|"elite";
  weakWindow: { open: number; period: number; len: number }; // cyclical window (ms)
  security: { tier: number };
  neighbors: string[];
};

export type Enemy = {
  id: string; name: string; hp: number; castEndsAt: number; casting?: string;
};

export type GameState = {
  rng: () => number;
  scheduler: Scheduler;
  resources: Resources;
  player: Player;
  map: { nodes: Record<string, Node>; start: string; current: string };
  enemy?: Enemy;
  logs: string[];
  onToast: (msg: string) => void;
  jobs: Record<number, { id: number; line: string; endsAt: number; startAt: number; bg: boolean; canceled?: boolean }>;
  nextJobId: number;
};

export function createRng(seed: number) {
  // xorshift32
  let x = seed | 0;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    const u = (x >>> 0) / 4294967296;
    return u;
  };
}

export function fmtMs(ms: number) { return (ms/1000).toFixed(2) + "s"; }

export function makeDemoMap(): Record<string, Node> {
  const nodes: Record<string, Node> = {};
  const add = (n: Node) => { nodes[n.id] = n; };
  add({ id: "node-a", name: "エントリ", kind: "normal", weakWindow: { open: 3000, period: 12000, len: 3000 }, security: { tier: 1 }, neighbors: ["node-b","node-c"] });
  add({ id: "node-b", name: "金庫-α", kind: "vault", weakWindow: { open: 8000, period: 16000, len: 4000 }, security: { tier: 2 }, neighbors: ["node-a","node-d"] });
  add({ id: "node-c", name: "ショップ", kind: "shop", weakWindow: { open: 5000, period: 15000, len: 3500 }, security: { tier: 1 }, neighbors: ["node-a","node-d"] });
  add({ id: "node-d", name: "休息", kind: "rest", weakWindow: { open: 6000, period: 18000, len: 4000 }, security: { tier: 1 }, neighbors: ["node-b","node-c","node-e"] });
  add({ id: "node-e", name: "エリート", kind: "elite", weakWindow: { open: 9000, period: 22000, len: 5000 }, security: { tier: 3 }, neighbors: ["node-d"] });
  return nodes;
}

export function drawAsciiMap(state: GameState): string {
  // simple fixed layout ascii
  const a = state.map.nodes["node-a"]; const b = state.map.nodes["node-b"]; const c = state.map.nodes["node-c"]; const d = state.map.nodes["node-d"]; const e = state.map.nodes["node-e"];
  const id = state.map.current;
  const mark = (node: Node) => node.id === id ? "["+node.name+ "]" : " "+node.name+" ";
  const weak = (node: Node) => isWeakOpen(state, node) ? "*" : " ";
  return (
    `   ${mark(b)}${weak(b)}\n`+
    `    ╱         ╲\n`+
    `${mark(a)}───┤           ├──${mark(d)}${weak(d)}\n`+
    `    ╲         ╱\n`+
    `   ${mark(c)}${weak(c)}      →→   ${mark(e)}${weak(e)}\n`
  );
}

export function isWeakOpen(state: GameState, n: Node): boolean {
  const t = state.scheduler.time();
  const { open, period, len } = n.weakWindow;
  const r = (t % period);
  return r >= open && r < open + len;
}

export type CommandCtx = { state: GameState; args: string[]; raw: string; write: (s:string)=>void };
export type CommandSpec = { id: string; castMs: number; gcdMs: number; cdMs: number; cost?: Partial<Resources>; run: (ctx: CommandCtx) => void };

export const Commands: Record<string, CommandSpec> = {} as any;

function consume(state: GameState, need: Partial<Resources>): boolean {
  const res = state.resources;
  const over: string[] = [];
  for (const k of ["cpu","mem","net","power","heat"] as (keyof Resources)[]) {
    if (need[k] == null) continue;
    const val = (res as any)[k] as number; const cap = (res as any)[k+"Cap"] as number;
    const newVal = val + (k==="heat" ? (need[k] as number) : -(need[k] as number));
    if (k!=="heat" && newVal < 0) over.push(k);
    if (k==="heat" && newVal > res.heatCap) over.push(k);
  }
  if (over.length) return false;
  for (const k of ["cpu","mem","net","power","heat"] as (keyof Resources)[]) {
    if (need[k] == null) continue;
    (state.resources as any)[k] = (state.resources as any)[k] + (k==="heat" ? (need[k] as number) : -(need[k] as number));
  }
  return true;
}

export function scheduleCast(ctx: CommandCtx, spec: CommandSpec, opts?: { bg?: boolean }) {
  const s = ctx.state;
  const now = s.scheduler.time();
  if (now < s.player.gcdUntil) {
    ctx.write(`GCD中: ${((s.player.gcdUntil-now)/1000).toFixed(2)}s`); return;
  }
  // simple cooldown key by command id
  const key = `cd:${spec.id}`;
  let cooling = false;
  // no central cd tracking for MVP; rely on user pacing
  // resource check up-front (approx)
  if (spec.cost && !consume(s, spec.cost)) {
    ctx.write("リソース不足"); return;
  }
  const castMs = opts?.bg ? spec.castMs * 3 : spec.castMs;
  const gcd = opts?.bg ? 0 : spec.gcdMs;
  s.player.gcdUntil = now + gcd;
  s.logs.push(`詠唱 ${spec.id} ${(castMs/1000).toFixed(2)}s${opts?.bg?"（バックグラウンド）":""}`);
  if (opts?.bg) {
    const id = s.nextJobId++;
    const jobKey = `job:${id}`;
    s.jobs[id] = { id, line: ctx.raw, startAt: now, endsAt: now + castMs, bg: true };
    s.scheduler.schedule(castMs, jobKey, () => {
      if (s.jobs[id]?.canceled) return;
      try { spec.run(ctx); ctx.write(`[job %${id}] 完了: ${spec.id}`); }
      finally { delete s.jobs[id]; }
    });
    ctx.write(`[job %${id}] 開始: ${spec.id} ${(castMs/1000).toFixed(2)}s`);
  } else {
    s.scheduler.schedule(castMs, `cast:${spec.id}:${now}`, () => {
      try { spec.run(ctx); } finally { /* cooldown stub */ }
    });
  }
}

export function registerCoreCommands(write: (s:string)=>void) {
  const add = (c: CommandSpec) => { Commands[c.id] = c; };
  // meta/map commands
  add({ id: "map", castMs: 0, gcdMs: 0, cdMs: 0, run: ({state, write}) => {
    write(drawAsciiMap(state));
  }});
  add({ id: "connect", castMs: 0, gcdMs: 0, cdMs: 0, run: ({state, write, args}) => {
    const id = args[0];
    if (!id || !state.map.nodes[id]) { write("ノードIDを指定してください（例: connect node-b）"); return; }
    if (!state.map.nodes[state.map.current].neighbors.includes(id)) { write("隣接していません"); return; }
    state.map.current = id;
    write(`接続先 → ${state.map.nodes[id].name}`);
  }});
  add({ id: "route", castMs: 0, gcdMs: 0, cdMs: 0, run: ({state, write, args}) => {
    const policy = args[0] === "--policy" ? (args[1] || "profit") : "profit";
    const here = state.map.nodes[state.map.current];
    const choices = here.neighbors.map(id => state.map.nodes[id]);
    let best = choices[0]; let bestScore = -Infinity; let msg = "";
    for (const n of choices) {
      const isVault = n.kind === "vault" ? 1 : 0;
      const t = state.scheduler.time();
      const r = t % n.weakWindow.period;
      const wait = r <= n.weakWindow.open ? (n.weakWindow.open - r) : (n.weakWindow.period - r + n.weakWindow.open);
      const score = (policy==="profit"? (isVault*2 - wait/10000) : (-wait/10000));
      if (score > bestScore) { bestScore = score; best = n; msg = `${n.name}（待機 ${(wait/1000).toFixed(1)}s）`; }
    }
    write(`推奨ルート[${policy}] → ${msg}`);
  }});
  add({ id: "breach", castMs: 0, gcdMs: 600, cdMs: 2000, run: ({state, write}) => {
    if (state.enemy) { write("既に交戦中"); return; }
    const hp = 18 + Math.floor(state.rng()*8);
    state.enemy = { id: "ice", name: "ICE", hp, castEndsAt: 0 };
    write(`侵入 → ${state.map.nodes[state.map.current].name}（敵HP:${hp}）`);
  }});
  add({ id: "scan", castMs: 400, gcdMs: 600, cdMs: 0, cost: { cpu: 1, net: 1 }, run: ({state, write}) => {
    state.logs.push("敵の脆弱性をスキャン"); write("scanned: 攻撃が強化される窓が開く（短時間）");
  }});
  add({ id: "inject", castMs: 600, gcdMs: 600, cdMs: 0, cost: { cpu: 2, net: 2, heat: 2 }, run: ({state, write, args}) => {
    const payload = args.includes("--payload") ? args[args.indexOf("--payload")+1] : "leak";
    const stackIdx = args.indexOf("--stack");
    const stacks = stackIdx>=0 ? Math.max(1, parseInt(args[stackIdx+1]||"1")) : 1;
    const dmg = payload === "burn" ? 6 + stacks*2 : 4 + stacks;
    if (!state.enemy) { write("敵がいません"); return; }
    state.enemy.hp -= dmg;
    write(`注入 ${payload} x${stacks} → ${dmg}ダメージ（敵HP:${Math.max(0,state.enemy.hp)}）`);
    if (state.enemy.hp <= 0) onWin(state, write);
  }});
  add({ id: "firewall", castMs: 300, gcdMs: 600, cdMs: 1500, cost: { power: 2 }, run: ({state, write, args}) => {
    const up = args[0] === "up" || args.length===0;
    const gain = up ? 6 : 4;
    state.player.shield = Math.min(30, state.player.shield + gain);
    write(`shield +${gain} (合計:${state.player.shield})`);
  }});
  add({ id: "lag", castMs: 300, gcdMs: 600, cdMs: 2000, cost: { cpu: 1, net: 1 }, run: ({state, write}) => {
    if (!state.enemy) { write("敵がいません"); return; }
    state.logs.push("敵行動を遅延"); write("敵テレグラフが遅くなる（簡易）");
  }});
  add({ id: "overclock", castMs: 0, gcdMs: 300, cdMs: 3000, cost: { power: 2, heat: 6 }, run: ({write}) => {
    write("次の詠唱が短縮（MVPでは演出のみ）");
  }});
  add({ id: "cool", castMs: 0, gcdMs: 300, cdMs: 2000, cost: { power: 3, heat: -8 }, run: ({state, write}) => {
    state.resources.heat = Math.max(0, state.resources.heat - 8);
    write("冷却: 熱 -8");
  }});
  add({ id: "jobs", castMs: 0, gcdMs: 0, cdMs: 0, run: ({state, write}) => {
    const ids = Object.keys(state.jobs).map(i => Number(i)).sort((a,b)=>a-b);
    if (!ids.length) { write("(no jobs)"); return; }
    for (const id of ids) {
      const j = state.jobs[id];
      const t = state.scheduler.time();
      const pct = Math.max(0, Math.min(100, ((t - j.startAt) / (j.endsAt - j.startAt)) * 100));
      write(`%${id}\t${j.line}\t${pct.toFixed(0)}%`);
    }
  }});
  add({ id: "kill", castMs: 0, gcdMs: 0, cdMs: 0, run: ({state, write, args}) => {
    const token = args[0] || ""; if (!token.startsWith("%")) { write("使い方: kill %<ID>"); return; }
    const id = Number(token.slice(1));
    if (!state.jobs[id]) { write(`該当ジョブなし: %${id}`); return; }
    state.jobs[id].canceled = true; delete state.jobs[id];
    write(`ジョブ終了: %${id}`);
  }});
}

export function onWin(state: GameState, write: (s:string)=>void) {
  let gain = 25 + Math.floor(state.rng()*25);
  // Vault急襲ボーナス: vaultの弱点窓中は倍率アップ
  const node = state.map.nodes[state.map.current];
  if (node.kind === "vault" && isWeakOpen(state, node)) {
    gain = Math.floor(gain * 1.5);
    state.onToast(`${node.name}: 急襲ボーナス！ Credits x1.5`);
  }
  state.player.credits += gain;
  write(`勝利！ クレジット +${gain}（計 ${state.player.credits}）`);
  state.enemy = undefined;
}

export function makeInitialState(seed: number, onToast: (msg:string)=>void): GameState {
  const scheduler = new Scheduler(50);
  const rng = createRng(seed);
  const nodes = makeDemoMap();
  const start = "node-a";
  const state: GameState = {
    rng,
    scheduler,
    resources: { cpu: 6, mem: 8, net: 6, power: 8, heat: 0, cpuCap: 6, memCap: 8, netCap: 6, powerCap: 8, heatCap: 100 },
    player: { hp: 30, shield: 0, credits: 0, trace: 0, gcdUntil: 0 },
    map: { nodes, start, current: start },
    logs: [],
    onToast,
    jobs: {},
    nextJobId: 1,
  };
  return state;
}
