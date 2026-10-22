import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "@/store/ui-store";

describe("ui-store (Zustand)", () => {
  beforeEach(() => {
    useUiStore.setState({ vaultUnlocked: false, demoMode: false, firstName: "" });
  });

  it("état initial sécurisé : coffre verrouillé, démo désactivée", () => {
    const state = useUiStore.getState();
    expect(state.vaultUnlocked).toBe(false);
    expect(state.demoMode).toBe(false);
  });

  it("permet de basculer le mode démonstration", () => {
    useUiStore.getState().setDemoMode(true);
    expect(useUiStore.getState().demoMode).toBe(true);
  });

  it("ne stocke jamais de clé ni de phrase (contrat du store)", () => {
    const state = useUiStore.getState();
    const keys = Object.keys(state);
    expect(keys).not.toContain("masterKey");
    expect(keys).not.toContain("passphrase");
    expect(keys).not.toContain("secret");
  });
});
