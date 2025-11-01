export type TaskKey = string;

type Scheduled = {
  at: number;
  key: TaskKey;
  run: () => void;
};

export class Scheduler {
  private now = 0;
  private queue: Scheduled[] = [];
  private tickMs: number;

  constructor(tickMs = 50) {
    this.tickMs = tickMs;
  }

  time() { return this.now; }

  schedule(delayMs: number, key: TaskKey, run: () => void) {
    const item: Scheduled = { at: this.now + delayMs, key, run };
    this.queue.push(item);
    this.queue.sort((a, b) => a.at - b.at);
  }

  cancel(key: TaskKey) {
    this.queue = this.queue.filter(q => q.key !== key);
  }

  step(dtMs: number) {
    this.now += dtMs;
    // fire due tasks conservatively (handle multiple due in one tick)
    let fired = 0;
    while (this.queue.length && this.queue[0].at <= this.now && fired < 100) {
      const next = this.queue.shift()!;
      try { next.run(); } catch (e) { console.error(e); }
      fired++;
    }
  }
}

