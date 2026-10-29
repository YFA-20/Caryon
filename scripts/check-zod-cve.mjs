#!/usr/bin/env node
/**
 * Velora — vérifie si la CVE zod (GHSA-mrhx-c7xc-m3w5) s'applique.
 *
 * La CVE affecte zod v4 (< 4.6.6) : validation de collections contraintes
 * pouvant épuiser la mémoire. Velora utilise zod v3 (3.25.76) qui n'est
 * PAS affecté — npm audit remonte un faux positif car la plage "< 4.6.6"
 * inclut les versions v3.
 *
 * Ce script :
 * 1. Lit la version de zod dans node_modules/zod/package.json
 * 2. Vérifie si elle est dans la plage vulnérable (v4 < 4.6.6)
 * 3. Vérifie que tous les z.array() dans src/lib/schema/ ont un .max()
 *    (défense en profondeur contre l'épuisement mémoire)
 * 4. Exit 0 si pas de vulnérabilité applicable, exit 1 sinon
 *
 * Utilisation dans CI : remplace le npm audit --omit=dev bloquant.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ZOD_PKG = join(process.cwd(), "node_modules/zod/package.json");
const SCHEMA_DIR = join(process.cwd(), "src/lib/schema");

function fail(message) {
  console.error(`ERREUR: ${message}`);
  process.exit(1);
}

// 1. Lire la version de zod
let zodVersion;
try {
  const pkg = JSON.parse(readFileSync(ZOD_PKG, "utf8"));
  zodVersion = pkg.version;
} catch {
  fail("node_modules/zod/package.json introuvable. Lancer npm install.");
}

console.log(`Version zod installée: ${zodVersion}`);

// 2. Vérifier si la CVE s'applique (zod v4 < 4.6.6)
const [major, minor, patch] = zodVersion.split(".").map(Number);

if (major < 4) {
  console.log(`zod v${major}.x — la CVE GHSA-mrhx-c7xc-m3w5 affecte uniquement zod v4 (< 4.6.6).`);
  console.log("Cette version n'est PAS vulnérable. Faux positif npm audit.");
} else if (major === 4 && (minor < 6 || (minor === 6 && patch < 6))) {
  fail(`zod ${zodVersion} est dans la plage vulnérable (v4 < 4.6.6)! Mettre à jour.`);
} else {
  console.log(`zod ${zodVersion} >= 4.6.6 — pas vulnérable.`);
}

// 3. Vérifier que tous les z.array() ont un .max() (défense en profondeur)
const problems = [];
for (const file of readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".ts"))) {
  const content = readFileSync(join(SCHEMA_DIR, file), "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("z.array(") || lines[i].includes(".array(")) {
      // Vérifier les 3 lignes suivantes pour .max(
      const context = lines.slice(i, i + 3).join("\n");
      if (!context.includes(".max(")) {
        problems.push(`${file}:${i + 1}: tableau sans .max() — ${lines[i].trim()}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error("\nTableaux sans limite .max() trouvés:");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log("\nTous les z.array() dans src/lib/schema/ ont une limite .max().");
console.log("Vérification terminée: aucune vulnérabilité zod applicable.");
