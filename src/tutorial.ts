import type { GameState } from "./game";
import type { TermApi } from "./terminal";

type Step = {
  id: string;
  title: string;
  desc: string;
  example?: string;
  done: (ev: { cmd?: string; args?: string[]; raw?: string; win?: boolean; state: GameState }) => boolean;
};

export function initTutorial(state: GameState, term: TermApi) {
  const steps: Step[] = [
    { id: "help", title: "コマンド一覧を見る", desc: "'help' と入力して利用可能なコマンドを確認しましょう。", example: "help", done: ({ cmd }) => cmd === "help" },
    { id: "route", title: "利益重視のルート", desc: "'route --policy profit' で金庫を狙う候補を見ます。", example: "route --policy profit", done: ({ raw }) => /route\s+--policy\s+profit/.test(raw||"") },
    { id: "connect", title: "隣の金庫に接続", desc: "'connect node-b' で金庫-αへ接続します。", example: "connect node-b", done: ({ cmd, args, state }) => cmd === "connect" && args?.[0] === "node-b" && state.map.current === "node-b" },
    { id: "breach", title: "侵入を開始", desc: "'breach' で交戦を開始します。", example: "breach", done: ({ cmd }) => cmd === "breach" },
    { id: "attack", title: "スキャンして注入", desc: "'scan' の後に 'inject --payload leak --stack 2' を使ってみましょう（直列でもOK）。", example: "scan ; inject --payload leak --stack 2", done: ({ raw }) => /inject\b/.test(raw||"") },
    { id: "defend", title: "防御を固める", desc: "'firewall up' でシールドを張ります。", example: "firewall up", done: ({ cmd }) => cmd === "firewall" },
    { id: "win", title: "勝利して稼ぐ", desc: "敵を倒してクレジットを獲得しましょう（Vaultの弱点ウィンドウ中なら増加）。", done: ({ win }) => !!win },
    { id: "cool", title: "熱管理", desc: "'cool --power 30' で熱を下げましょう。", example: "cool --power 30", done: ({ cmd }) => cmd === "cool" },
    { id: "bg", title: "バックグラウンド実行", desc: "末尾に '&' を付けるとBG実行。'scan &' を試して 'jobs' で確認。", example: "scan & ; jobs", done: ({ cmd }) => cmd === "jobs" },
  ];

  let idx = 0;
  const overlay = document.createElement("div");
  overlay.id = "tutorial-overlay";
  overlay.innerHTML = `
    <div class="panel">
      <div class="head">
        <strong>チュートリアル</strong>
        <div class="spacer"></div>
        <button id="tut-close">閉じる</button>
      </div>
      <div id="tut-body"></div>
      <div class="foot">
        <button id="tut-skip">スキップ</button>
        <div class="spacer"></div>
        <button id="tut-prev">戻る</button>
        <button id="tut-next">次へ</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  function render() {
    const body = overlay.querySelector("#tut-body") as HTMLElement;
    const s = steps[idx];
    const prog = `${idx+1}/${steps.length}`;
    body.innerHTML = `
      <div class="step">
        <div class="title">${prog}：${s.title}</div>
        <div class="desc">${s.desc}</div>
        ${s.example? `<div class="ex"><code>${s.example}</code> <button id="tut-run">自動入力</button></div>`: ""}
      </div>
      <ol class="list">
        ${steps.map((st, i) => `<li class="${i < idx ? 'done' : (i===idx?'active':'')}">${st.title}</li>`).join("")}
      </ol>`;
    const runBtn = body.querySelector("#tut-run");
    runBtn?.addEventListener("click", () => { if (s.example) term.run(s.example); });
  }

  function open() { overlay.style.display = "flex"; render(); }
  function close() { overlay.style.display = "none"; }
  function next() { if (idx < steps.length - 1) { idx++; render(); } else { close(); } }
  function prev() { if (idx > 0) { idx--; render(); } }

  overlay.querySelector("#tut-close")!.addEventListener("click", close);
  overlay.querySelector("#tut-next")!.addEventListener("click", next);
  overlay.querySelector("#tut-prev")!.addEventListener("click", prev);
  overlay.querySelector("#tut-skip")!.addEventListener("click", () => { idx = steps.length - 1; render(); });

  // 進行フック
  state.onCommand = (cmd, args, raw) => {
    const s = steps[idx];
    if (s && s.done({ cmd, args, raw, state })) { idx = Math.min(idx + 1, steps.length - 1); render(); }
  };
  state.onWinEvent = () => {
    const s = steps[idx];
    if (s && s.done({ win: true, state })) { idx = Math.min(idx + 1, steps.length - 1); render(); }
  };

  // 最初は自動で開く
  open();
  return { open, close };
}

