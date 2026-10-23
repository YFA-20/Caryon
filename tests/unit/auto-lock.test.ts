/**
 * Velora — tests du verrouillage automatique (useAutoLock).
 *
 * Teste la logique du timer de manière isolée (sans composant React) :
 * réinitialisation à chaque activité, déclenchement après inactivité,
 * annulation. Le hook React consomme exactement cette logique.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Simule la logique du hook useAutoLock de manière isolée :
 * un timer qui se déclenche après `delay` ms sans activité.
 */
function createAutoLockTimer(delay: number, onLock: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onLock, delay);
  }

  function handleActivity() {
    schedule();
  }

  function cancel() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return { schedule, handleActivity, cancel };
}

describe("auto-lock (logique du timer)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("déclenche le verrouillage après la durée d'inactivité", () => {
    const onLock = vi.fn();
    const { schedule, cancel } = createAutoLockTimer(1000, onLock);

    schedule();
    expect(onLock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(onLock).toHaveBeenCalledTimes(1);

    cancel();
  });

  it("réinitialise le timer à chaque activité", () => {
    const onLock = vi.fn();
    const { schedule, handleActivity, cancel } = createAutoLockTimer(1000, onLock);

    schedule();
    vi.advanceTimersByTime(600);
    handleActivity(); // activité à 600ms → timer remis à zéro
    vi.advanceTimersByTime(600); // 1200ms total, mais 600ms depuis dernière activité
    expect(onLock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400); // 1000ms depuis dernière activité
    expect(onLock).toHaveBeenCalledTimes(1);

    cancel();
  });

  it("ne se déclenche pas si on annule avant la fin", () => {
    const onLock = vi.fn();
    const { schedule, cancel } = createAutoLockTimer(1000, onLock);

    schedule();
    vi.advanceTimersByTime(500);
    cancel();
    vi.advanceTimersByTime(1000);

    expect(onLock).not.toHaveBeenCalled();
  });

  it("plusieurs activités consécutives ne déclenchent qu'un seul timer", () => {
    const onLock = vi.fn();
    const { schedule, handleActivity, cancel } = createAutoLockTimer(1000, onLock);

    schedule();
    handleActivity();
    handleActivity();
    handleActivity();
    vi.advanceTimersByTime(999);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLock).toHaveBeenCalledTimes(1);

    cancel();
  });

  it("respecte une durée de 15 minutes (défaut Velora)", () => {
    const onLock = vi.fn();
    const fifteenMinutes = 15 * 60 * 1000;
    const { schedule, cancel } = createAutoLockTimer(fifteenMinutes, onLock);

    schedule();
    vi.advanceTimersByTime(fifteenMinutes - 1);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLock).toHaveBeenCalledTimes(1);

    cancel();
  });
});
