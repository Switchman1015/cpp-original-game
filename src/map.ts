import type { GameState, Node } from "./game";
import { isWeakOpen } from "./game";

type Pt = { x: number; y: number };

// 固定レイアウト（0..1 の正規化座標）
const LAYOUT: Record<string, Pt> = {
  "node-b": { x: 0.5, y: 0.18 },
  "node-a": { x: 0.22, y: 0.5 },
  "node-d": { x: 0.78, y: 0.5 },
  "node-c": { x: 0.32, y: 0.82 },
  "node-e": { x: 0.86, y: 0.85 },
};

function dpiResize(canvas: HTMLCanvasElement) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(200, Math.floor(rect.width));
  const h = Math.max(160, Math.floor(rect.height));
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, dpr };
}

function nodeColor(n: Node): string {
  switch (n.kind) {
    case "vault": return "#00eaff";
    case "shop": return "#9cff00";
    case "rest": return "#84b3ff";
    case "elite": return "#ff3fd7";
    default: return "#8bb3d9";
  }
}

export function drawMap(canvas: HTMLCanvasElement, state: GameState) {
  const { w, h } = dpiResize(canvas);
  const ctx = canvas.getContext("2d")!;
  // 背景グリッド
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = "#1b2a41";
  ctx.lineWidth = 1;
  const grid = 24;
  for (let x = (w % grid); x < w; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = (h % grid); y < h; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.restore();

  // 位置
  const pos = (id: string): Pt => {
    const p = LAYOUT[id] || { x: Math.random()*0.8+0.1, y: Math.random()*0.8+0.1 };
    return { x: p.x * w, y: p.y * h };
  };

  // エッジ
  const visited = new Set<string>();
  ctx.lineWidth = 2;
  for (const id in state.map.nodes) {
    const n = state.map.nodes[id];
    for (const to of n.neighbors) {
      const key = id < to ? `${id}-${to}` : `${to}-${id}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const a = pos(id), b = pos(to);
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, "#0b8cff");
      grad.addColorStop(1, "#00eaff");
      ctx.strokeStyle = grad;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // ノード
  const now = state.scheduler.time();
  for (const id in state.map.nodes) {
    const n = state.map.nodes[id];
    const p = pos(id);
    const r = 12;
    // 発光
    ctx.save();
    ctx.translate(p.x, p.y);
    const base = nodeColor(n);
    // 弱点ウィンドウ演出
    if (isWeakOpen(state, n)) {
      const phase = (now % 1000) / 1000; // 0..1
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(phase * Math.PI * 2);
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.arc(0, 0, r + 10, 0, Math.PI * 2); ctx.fill();
    }
    // ノード本体
    ctx.globalAlpha = 1;
    ctx.fillStyle = base;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // 枠（現在地）
    if (state.map.current === id) {
      ctx.lineWidth = 3; ctx.strokeStyle = "#ffff66"; ctx.stroke();
    } else {
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#21324a"; ctx.stroke();
    }
    // ラベル
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#c7e6ff";
    ctx.shadowColor = "rgba(0,234,255,0.25)";
    ctx.shadowBlur = 4;
    ctx.fillText(n.name, 0, r + 6);
    ctx.restore();
  }
}

