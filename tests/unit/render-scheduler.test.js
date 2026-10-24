import { expect, it, vi } from 'vitest';
import { createRenderScheduler } from '../../src/scene/renderScheduler.js';

function harness() {
  const queue = new Map();
  let id = 0;
  const host = {
    requestAnimationFrame: (callback) => {
      queue.set(++id, callback);
      return id;
    },
    cancelAnimationFrame: (frame) => queue.delete(frame),
  };
  const render = vi.fn();
  const update = vi.fn(() => false);
  const isAnimating = vi.fn(() => false);
  const scheduler = createRenderScheduler({
    host,
    render,
    update,
    isAnimating,
  });
  const tick = () => {
    const callbacks = [...queue.values()];
    queue.clear();
    callbacks.forEach((fn) => fn());
  };
  return { queue, render, update, isAnimating, scheduler, tick };
}
it('coalesces mutations and has no permanent idle animation loop', () => {
  const h = harness();
  for (let i = 0; i < 100; i++) h.scheduler.invalidate();
  expect(h.queue.size).toBe(1);
  h.tick();
  expect(h.render).toHaveBeenCalledOnce();
  expect(h.queue.size).toBe(0);
});
it('continues damping change events and auto-rotation, then stops when settled', () => {
  const h = harness();
  h.update.mockImplementationOnce(() => {
    h.scheduler.invalidate();
    return true;
  });
  h.scheduler.invalidate();
  h.tick();
  expect(h.queue.size).toBe(1);
  h.tick();
  expect(h.render).toHaveBeenCalledOnce();
  expect(h.queue.size).toBe(0);
  h.isAnimating.mockReturnValue(true);
  h.scheduler.invalidate();
  h.tick();
  expect(h.queue.size).toBe(1);
  h.isAnimating.mockReturnValue(false);
  h.tick();
  expect(h.queue.size).toBe(0);
});
it('suspends background work, resumes once, and cancels permanently on teardown', () => {
  const h = harness();
  h.scheduler.invalidate();
  h.scheduler.setSuspended(true);
  h.scheduler.invalidate();
  expect(h.queue.size).toBe(0);
  h.scheduler.setSuspended(false);
  h.tick();
  expect(h.render).toHaveBeenCalledOnce();
  h.scheduler.invalidate();
  h.scheduler.dispose();
  h.scheduler.invalidate();
  expect(h.queue.size).toBe(0);
});
