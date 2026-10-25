import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "@/store/ui-store";

describe("ui-store (Zustand)", () => {
  beforeEach(() => {
    useUiStore.setState({ demoMode: false, firstName: "", drawerOpen: false });
  });

  it("état initial sécurisé : démo désactivée", () => {
    const state = useUiStore.getState();
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
    // vaultUnlocked a été supprimé (dead code) — Bug #3
    expect(keys).not.toContain("vaultUnlocked");
    expect(keys).not.toContain("setVaultUnlocked");
  });

  it("ne contient pas de champ vaultUnlocked (source de vérité = vaultStore)", () => {
    const state = useUiStore.getState();
    expect("vaultUnlocked" in state).toBe(false);
    expect("setVaultUnlocked" in state).toBe(false);
  });
});
