import { describe, expect, it } from 'vitest';
import { jump, newRun, stepRun } from '../src/runner';
describe('birthday runner', () => {
  it('collects rings once and only in the player lane', () => {
    const run = newRun();
    run.items = [{ id: 1, lane: 1, depth: .879, kind: 'ring', checked: false }, { id: 2, lane: 0, depth: .879, kind: 'ring', checked: false }];
    expect(stepRun(run, .02)).toBe(1); expect(run.score).toBe(100);
    expect(stepRun(run, .02)).toBe(0); expect(run.rings).toBe(1);
  });
  it('deducts a life on collision and rewards jumping over an obstacle', () => {
    const run = newRun(); run.score = 100;
    run.items = [{ id: 1, lane: 1, depth: .879, kind: 'obstacle', checked: false }];
    stepRun(run, .02); expect(run.lives).toBe(2); expect(run.score).toBe(50);
    run.items = [{ id: 2, lane: 1, depth: .879, kind: 'obstacle', checked: false }];
    jump(run); stepRun(run, .02); expect(run.lives).toBe(2); expect(run.score).toBe(100);
  });
  it('ends after thirty seconds and stops changing the score', () => {
    const run = newRun(); run.elapsed = 29.99;
    stepRun(run, .02); expect(run.done).toBe(true);
    const score = run.score; stepRun(run, 1); expect(run.score).toBe(score);
  });
  it('ends when the last life is lost and bounds background frame gaps', () => {
    const run = newRun(); run.lives = 1;
    run.items = [{ id: 1, lane: 1, depth: .879, kind: 'obstacle', checked: false }];
    stepRun(run, 100); expect(run.elapsed).toBe(.05); expect(run.lives).toBe(0); expect(run.done).toBe(true);
  });
});
