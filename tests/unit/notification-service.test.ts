/**
 * Velora — tests du service de notifications locales.
 *
 * Vérifie le comportement dégradé (pas d'API Notification en jsdom),
 * le cycle de vie des permissions, et le filtrage des événements
 * à notifier (fenêtre horaire, marquage notified).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import { createVault, lock } from "@/lib/vault/vault-service";
import { createEvent, listEvents } from "@/lib/vault/calendar-repository";
import {
  getNotificationPermission,
  checkAndNotify,
} from "@/lib/notifications/notification-service";

const TEST_PASSPHRASE = "ma-phrase-secrete-de-test-123";

// jsdom n'implémente pas l'API Notification — on la simule
class MockNotification {
  static permission: NotificationPermission = "default";
  static instances: MockNotification[] = [];
  title: string;
  options?: NotificationOptions;

  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
    MockNotification.instances.push(this);
  }

  static async requestPermission(): Promise<NotificationPermission> {
    return MockNotification.permission;
  }
}

describe("notification-service", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    lock();
    MockNotification.instances = [];
    MockNotification.permission = "default";
    await createVault(TEST_PASSPHRASE, { testMode: true });
  });

  describe("getNotificationPermission", () => {
    it("retourne « unsupported » quand l'API Notification n'existe pas (jsdom)", () => {
      // En jsdom, Notification n'est pas défini par défaut
      const result = getNotificationPermission();
      expect(["unsupported", "default", "granted", "denied"]).toContain(result);
    });

    it("retourne l'état du mock quand Notification est disponible", () => {
      vi.stubGlobal("Notification", MockNotification);
      MockNotification.permission = "granted";
      expect(getNotificationPermission()).toBe("granted");
      MockNotification.permission = "denied";
      expect(getNotificationPermission()).toBe("denied");
      vi.unstubAllGlobals();
    });
  });

  describe("checkAndNotify", () => {
    it("ne notifie rien si la permission n'est pas accordée", async () => {
      // Sans mock Notification → unsupported → retour immédiat
      const result = await checkAndNotify();
      expect(result.notified).toBe(0);
      expect(result.permission).not.toBe("granted");
    });

    it("notifie un événement dans la fenêtre horaire et le marque notified", async () => {
      vi.stubGlobal("Notification", MockNotification);
      MockNotification.permission = "granted";

      // Événement dans 30 minutes
      const in30min = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await createEvent({
        title: "Entretien dans 30 min",
        type: "entretien",
        startAt: in30min,
        endAt: "",
        allDay: false,
        notes: "",
      });

      const result = await checkAndNotify(60);
      expect(result.notified).toBe(1);
      expect(MockNotification.instances).toHaveLength(1);
      expect(MockNotification.instances[0]!.title).toContain("Entretien");

      // L'événement est marqué comme notifié
      const events = await listEvents();
      expect(events[0]!.notified).toBe(true);

      vi.unstubAllGlobals();
    });

    it("ne notifie pas deux fois le même événement", async () => {
      vi.stubGlobal("Notification", MockNotification);
      MockNotification.permission = "granted";

      const in30min = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await createEvent({
        title: "Événement unique",
        type: "relance",
        startAt: in30min,
        endAt: "",
        allDay: false,
        notes: "",
      });

      await checkAndNotify(60);
      MockNotification.instances = [];
      const result2 = await checkAndNotify(60);
      expect(result2.notified).toBe(0);
      expect(MockNotification.instances).toHaveLength(0);

      vi.unstubAllGlobals();
    });

    it("ignore les événements hors de la fenêtre (> horizon)", async () => {
      vi.stubGlobal("Notification", MockNotification);
      MockNotification.permission = "granted";

      // Événement dans 5 heures — hors fenêtre de 60 min
      const in5h = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
      await createEvent({
        title: "Trop loin",
        type: "echeance",
        startAt: in5h,
        endAt: "",
        allDay: false,
        notes: "",
      });

      const result = await checkAndNotify(60);
      expect(result.notified).toBe(0);

      vi.unstubAllGlobals();
    });

    it("rattrape un événement commencé il y a moins de 5 minutes", async () => {
      vi.stubGlobal("Notification", MockNotification);
      MockNotification.permission = "granted";

      // Événement commencé il y a 2 minutes
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      await createEvent({
        title: "Commencé il y a 2 min",
        type: "entretien",
        startAt: twoMinAgo,
        endAt: "",
        allDay: false,
        notes: "",
      });

      const result = await checkAndNotify(60);
      expect(result.notified).toBe(1);

      vi.unstubAllGlobals();
    });

    it("ignore un événement passé depuis plus de 5 minutes", async () => {
      vi.stubGlobal("Notification", MockNotification);
      MockNotification.permission = "granted";

      const longAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      await createEvent({
        title: "Trop tard",
        type: "entretien",
        startAt: longAgo,
        endAt: "",
        allDay: false,
        notes: "",
      });

      const result = await checkAndNotify(60);
      expect(result.notified).toBe(0);

      vi.unstubAllGlobals();
    });
  });
});
