export type RunnerItem = { id: number; lane: number; depth: number; kind: 'ring' | 'obstacle'; checked: boolean };
export type Run = { elapsed: number; lane: number; jump: number; cooldown: number; score: number; rings: number; lives: number; items: RunnerItem[]; spawn: number; serial: number; hit: number; done: boolean };
export const RUN_SECONDS = 30;
export function newRun(): Run { return { elapsed: 0, lane: 1, jump: 0, cooldown: 0, score: 0, rings: 0, lives: 3, items: [], spawn: .5, serial: 0, hit: 0, done: false }; }
export function jump(run: Run) { if (run.jump <= 0 && run.cooldown <= 0 && !run.done) { run.jump = .85; run.cooldown = 1; } }
export function stepRun(run: Run, dt: number, random = Math.random): number {
  if (run.done) return 0;
  dt = Math.min(.05, Math.max(0, dt)); run.elapsed += dt; run.jump = Math.max(0, run.jump - dt); run.cooldown = Math.max(0, run.cooldown - dt); run.hit = Math.max(0, run.hit - dt); run.spawn -= dt;
  if (run.spawn <= 0) { run.items.push({ id: run.serial++, lane: Math.floor(random() * 3), depth: 0, kind: random() < .7 ? 'ring' : 'obstacle', checked: false }); run.spawn = Math.max(.45, .8 - run.elapsed * .008); }
  let collected = 0; const speed = .39 + run.elapsed * .003;
  for (const item of run.items) { item.depth += dt * speed; if (!item.checked && item.depth >= .88) { item.checked = true; if (item.lane === run.lane) { if (item.kind === 'ring') { run.score += 100; run.rings++; collected++; } else if (run.jump <= 0 && run.hit <= 0) { run.lives--; run.hit = 1; run.score = Math.max(0, run.score - 50); } else if (run.jump > 0) run.score += 50; } } }
  run.items = run.items.filter(item => item.depth < 1.1);
  run.done = run.elapsed >= RUN_SECONDS || run.lives <= 0; return collected;
}
