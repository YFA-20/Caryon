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

-- M\u00e9tadonn\u00e9es du coffre pour la restauration multi-appareils.
-- Contient les param\u00e8tres KDF + salt + cl\u00e9 ma\u00eetre wrapp\u00e9e + verifier.
-- S\u00c9CURIT\u00c9 : la cl\u00e9 ma\u00eetre wrapp\u00e9e est INUTILISABLE sans la phrase secr\u00e8te
-- (elle est chiffr\u00e9e par la KEK d\u00e9riv\u00e9e de la phrase via Argon2id).
-- Le serveur ne peut donc pas d\u00e9chiffrer les donn\u00e9es m\u00eame s'il est compromis.
CREATE TABLE IF NOT EXISTS vault_meta (
  vault_id TEXT PRIMARY KEY,
  -- Version du format (1).
  version INTEGER NOT NULL DEFAULT 1,
  -- Date de cr\u00e9ation du coffre (ISO 8601).
  created_at TEXT NOT NULL,
  -- Param\u00e8tres KDF s\u00e9rialis\u00e9s en JSON (argon2id, memoryKiB, iterations, parallelism, hashLength).
  kdf TEXT NOT NULL,
  -- Sel (base64url, 16 octets).
  salt TEXT NOT NULL,
  -- Cl\u00e9 ma\u00eetre wrapp\u00e9e par la KEK (base64url) \u2014 INUTILISABLE sans la phrase.
  wrapped_master_key TEXT NOT NULL,
  -- IV du wrapping (base64url).
  wrap_iv TEXT NOT NULL,
  -- Verifier (base64url) \u2014 permet de v\u00e9rifier la phrase sans d\u00e9chiffrer les donn\u00e9es.
  verifier TEXT NOT NULL,
  -- IV du verifier (base64url).
  verifier_iv TEXT NOT NULL,
  -- D\u00e9lai d'auto-lock en ms.
  auto_lock_ms INTEGER NOT NULL DEFAULT 900000,
  -- Date de derni\u00e8re mise \u00e0 jour des m\u00e9tadonn\u00e9es (ISO 8601).
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Appareil qui a pouss\u00e9 ces m\u00e9tadonn\u00e9es en dernier.
  updated_by_device_id TEXT NOT NULL
);
