-- Velora — schéma D1 (SQLite) pour la synchronisation multi-appareils.
--
-- INVARIANT : ce schéma ne contient JAMAIS de données en clair.
-- `payload_ref` pointe vers un objet R2 (ciphertext AES-256-GCM).
-- Le serveur ne peut ni lire ni modifier les données sans invalider le tag GCM.

-- Métadonnées des enregistrements synchronisés.
CREATE TABLE IF NOT EXISTS sync_records (
  vault_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('record', 'document')),
  record_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  -- Référence R2 vers le payload chiffré (clé d'objet).
  payload_ref TEXT NOT NULL,
  -- Taille du payload en octets (pour filtrer sans télécharger).
  size INTEGER NOT NULL DEFAULT 0,
  -- Métadonnées non sensibles sérialisées en JSON (ex: {"status":"sent"}).
  meta TEXT,
  -- Date de dernière modification (ISO 8601) — last-write-wins.
  updated_at TEXT NOT NULL,
  -- Appareil auteur de cette version.
  device_id TEXT NOT NULL,
  -- Tombstone : 1 si supprimé (pas de perte silencieuse).
  tombstone INTEGER NOT NULL DEFAULT 0,
  -- Date de réception par le serveur (pour le nettoyage).
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (vault_id, kind, record_id)
);

-- Index pour le pull incrémental (depuis un timestamp).
CREATE INDEX IF NOT EXISTS idx_sync_records_updated
  ON sync_records(vault_id, updated_at);

-- Index pour le listing par appareil.
CREATE INDEX IF NOT EXISTS idx_sync_records_device
  ON sync_records(vault_id, device_id);

-- Appareils appairés à un coffre.
CREATE TABLE IF NOT EXISTS paired_devices (
  vault_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  paired_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (vault_id, device_id)
);

-- Demandes d'appairage en attente (code 6 chiffres, TTL 10 min).
CREATE TABLE IF NOT EXISTS pairing_requests (
  pairing_id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  new_device_id TEXT NOT NULL,
  new_device_name TEXT NOT NULL,
  -- Code à 6 chiffres (hashé côté serveur, jamais stocké en clair).
  code_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  approved_by_device_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Index pour le nettoyage des demandes expirées.
CREATE INDEX IF NOT EXISTS idx_pairing_expires
  ON pairing_requests(expires_at);
