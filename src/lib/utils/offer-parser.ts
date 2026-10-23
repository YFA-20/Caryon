/**
 * Velora — extraction locale d'informations depuis un texte d'offre.
 *
 * Parsing 100% déterministe (expressions régulières + heuristiques), sans IA,
 * sans appel réseau. L'utilisateur VÉRIFIE et corrige toujours les champs
 * extraits avant création de la candidature.
 */
import type { ApplicationType } from "@/lib/schema/application";

export interface ParsedOffer {
  company: string;
  position: string;
  type: ApplicationType | "";
  location: string;
  remote: boolean;
  salary: string;
  source: string;
  /** Texte nettoyé (tronqué pour pré-remplir les notes). */
  excerpt: string;
  /** Champs détectés (pour indiquer à l'utilisateur ce qui a été trouvé). */
  detectedFields: string[];
}

const MAX_EXCERPT = 2000;

/** Nettoie le texte collé (espaces, retours à la ligne multiples). */
function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectType(text: string): ApplicationType | "" {
  const t = text.toLowerCase();
  if (
    /\bstage\b|\bintership\b|\bmontage\b/.test(t) &&
    /\b6 mois\b|\b6months\b|\b3 mois\b/.test(t)
  ) {
    return "stage";
  }
  if (/\balternance\b|\bapprentissage\b|\bcontrat pro\b|\bcontrat professionnel\b/.test(t)) {
    return "alternance";
  }
  if (
    /\bcdi\b|\bcontrat à durée indéterminée\b|\bcontrat a durée indéterminée\b|\bpermanent\b/.test(
      t
    )
  ) {
    return "cdi";
  }
  if (
    /\bcdd\b|\bcontrat à durée déterminée\b|\bcontrat a durée déterminée\b|\bfixed[- ]term\b/.test(
      t
    )
  ) {
    return "cdd";
  }
  if (/\bfreelance\b|\bindépendant\b|\bindépendante\b|\bprestation\b/.test(t)) {
    return "freelance";
  }
  return "";
}

function detectRemote(text: string): boolean {
  const t = text.toLowerCase();
  // Négation explicite : « pas de télétravail », « 100% présentiel », « sur site uniquement »
  if (
    /\bpas de (télétravail|teletravail|remote)\b|\b100% présentiel\b|\b100% presentiel\b|\bprésentiel uniquement\b|\bpresentiel uniquement\b|\bsur site uniquement\b|\bpas de home[- ]office\b/.test(
      t
    )
  ) {
    return false;
  }
  return /\btélétravail\b|\bteletravail\b|\bremote\b|\b100% remote\b|\bfull remote\b|\bdistanciel\b|\bwork from home\b|\bhome office\b|\bhybride\b/.test(
    t
  );
}

function detectSalary(text: string): string {
  // Formats : "45 000 €", "45-55k€", "45 000 – 55 000 EUR/an", "2 500 €/mois", "Selon profil"
  const patterns = [
    // Fourchette : « 45 000 € – 55 000 € », « 50k€ - 65k€ », « 45 000 - 55 000 EUR »
    /\d{1,3}(?:[ \u00a0]\d{3})*\s*k?\s*(?:€|EUR|euros?)?\s*(?:-|–|à)\s*\d{1,3}(?:[ \u00a0]\d{3})*\s*k?\s*(?:€|EUR|euros?)/gi,
    // Simple : « 45 000 € », « 50k€ », « 2 500 €/mois »
    /\d{1,3}(?:[ \u00a0]\d{3})*\s*k?\s*(?:€|EUR|euros?)(\s*(?:\/|par)\s*(?:mois|an|année|annee))?/gi,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match && match[0]) {
      return match[0].replace(/\s+/g, " ").trim();
    }
  }
  if (/selon profil|selon expérience|selon experience|à définir|a definir/i.test(text)) {
    return "Selon profil";
  }
  return "";
}

function detectLocation(text: string): string {
  // Villes françaises courantes + "Ville (XX)" + "Ville, France"
  const cityPattern =
    /\b(Paris|Lyon|Marseille|Toulouse|Bordeaux|Lille|Nantes|Strasbourg|Montpellier|Rennes|Nice|Grenoble|Rouen|Toulon|Angers|Dijon|Le Havre|Saint-Étienne|Saint-Etienne|Villeurbanne|Le Mans|Rouen|Aix-en-Provence|Nîmes|Nimes|Annecy|La Rochelle|Pau|Bayonne|Metz|Nancy|Clermont-Ferrand|Brest|Tours|Caen|Orléans|Amiens|Perpignan|Boulogne-Billancourt|Mulhouse|Caen)\b(?:\s*\(\d{2}\))?(?:\s*,\s*(?:France|IDF|Île-de-France|Ile-de-France))?/i;
  const match = text.match(cityPattern);
  if (match && match[0]) {
    return match[0].replace(/\s+/g, " ").trim();
  }
  return "";
}

function detectCompany(text: string): string {
  // "Entreprise : X", "Société : X", "chez X", "X recrute", "X recherche"
  const patterns = [
    /(?:entreprise|société|societe|société)\s*:\s*([^\n,;.]{2,80})/i,
    /(?:chez|pour le compte de)\s+([A-ZÀ-Ü][^\n,;.]{2,80})/i,
    /^([A-ZÀ-Ü][A-Za-zÀ-Ü0-9&.'-]*(?:\s+[A-ZÀ-Ü][A-Za-zÀ-Ü0-9&.'-]*)*)\s+(?:recrute|recherche|embauche)/m,
    /(?:rejoignez|rejoins)\s+([A-ZÀ-Ü][^\n,;.]{2,80})/i,
    // Fallback : nom propre suivi d'une forme juridique ou d'un secteur
    /\b([A-ZÀ-Ü][A-Za-zÀ-Ü0-9&.'-]{2,40}(?:\s+(?:SA|SAS|SASU|SARL|EURL|Group|Studio|Labs|Solutions|Technologies|Digital|Consulting|Conseil|Partners|Agency))?)\b/,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match && match[1]) {
      const cleaned = match[1].replace(/\s+/g, " ").trim();
      if (cleaned.length >= 2 && cleaned.length <= 80) {
        return cleaned;
      }
    }
  }
  // Fallback : première ligne en majuscules ou titre
  const firstLine = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length >= 3 && l.length <= 80);
  if (firstLine && /[A-ZÀ-Ü]/.test(firstLine)) {
    return firstLine.replace(/\s+/g, " ");
  }
  return "";
}

function detectPosition(text: string): string {
  // "Poste : X", "Intitulé : X", "Poste recherché : X", "Vous serez...", "Nous recherchons un(e) X"
  const patterns = [
    /(?:poste|intitulé|intitule|position|fonction|titre)\s*:\s*([^\n]{3,120})/i,
    /nous\s+(?:recherchons|recrutons|embauchons)\s+(?:un\(e\)|une?|des?)\s+([^\n,.]{3,120})/i,
    /(?:vous\s+serez|vous\s+serez\s+en\s+charge\s+de|profil\s+recherché\s*:)\s*([^\n]{3,120})/i,
    /(?:rejoignez-nous\s+en\s+tant\s+que|en\s+tant\s+que)\s+([^\n,.]{3,80})/i,
    /\b(développeur|developpeur|développeuse|ingénieur|ingenieur|ingénieure|designer|product manager|chef de projet|data analyst|scrum master|devops|consultant|commercial|marketing|graphiste|ux designer|ui designer|full[- ]stack|front[- ]end|back[- ]end|mobile|qa|tester|technicien|technicienne|assistant|assistante|responsable|chargé de|chargee de)\s+([^\n,.]{0,80})/i,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match) {
      const raw = (match[2] ?? match[1] ?? "").trim();
      if (raw.length >= 3 && raw.length <= 120) {
        // Nettoie les préfixes génériques
        const cleaned = raw
          .replace(/^(un\(e\)|une?|des?|le|la|les)\s+/i, "")
          .replace(/\s+(H\/F|h\/f|F\/H|f\/h|H-F|F-H)\s*$/i, "")
          .replace(/\s*[-–—]\s*.*$/, "")
          .trim();
        if (cleaned.length >= 3) {
          return cleaned;
        }
      }
    }
  }
  return "";
}

function detectSource(text: string, fallbackUrl: string): string {
  if (fallbackUrl) {
    try {
      const host = new URL(fallbackUrl).hostname.replace(/^www\./, "");
      const known: Record<string, string> = {
        "linkedin.com": "LinkedIn",
        "fr.linkedin.com": "LinkedIn",
        "indeed.fr": "Indeed",
        "www.indeed.fr": "Indeed",
        "welcometothejungle.com": "Welcome to the Jungle",
        "www.welcometothejungle.com": "Welcome to the Jungle",
        "apec.fr": "APEC",
        "www.apec.fr": "APEC",
        "lesjeudis.com": "Les Jeudis",
        "www.lesjeudis.com": "Les Jeudis",
        "handicap-job.com": "Handicap Job",
        "malt.fr": "Malt",
        "www.malt.fr": "Malt",
        "freelance.com": "Freelance.com",
        "hellowork.com": "HelloWork",
        "www.hellowork.com": "HelloWork",
        "cadremploi.fr": "Cadremploi",
        "www.cadremploi.fr": "Cadremploi",
        "monster.fr": "Monster",
        "www.monster.fr": "Monster",
        "optioncarriere.com": "OptionCarrière",
        "www.optioncarriere.com": "OptionCarrière",
      };
      const knownSource = known[host];
      if (knownSource) return knownSource;
      // Capitalise le domaine
      const domain = host.split(".")[0] ?? host;
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
      return "";
    }
  }
  return "Copié depuis une offre";
}

/**
 * Extrait les informations structurées d'un texte d'offre d'emploi.
 *
 * @param rawText Le texte brut de l'offre (collé par l'utilisateur)
 * @param sourceUrl URL de l'offre (optionnel, pour détecter la source)
 */
export function parseOfferText(rawText: string, sourceUrl = ""): ParsedOffer {
  const text = cleanText(rawText);
  const detectedFields: string[] = [];

  const company = detectCompany(text);
  if (company) detectedFields.push("entreprise");

  const position = detectPosition(text);
  if (position) detectedFields.push("poste");

  const type = detectType(text);
  if (type) detectedFields.push("type");

  const location = detectLocation(text);
  if (location) detectedFields.push("localisation");

  const remote = detectRemote(text);
  if (remote) detectedFields.push("télétravail");

  const salary = detectSalary(text);
  if (salary) detectedFields.push("salaire");

  const source = detectSource(text, sourceUrl);
  // « source » n'est poussé dans detectedFields que si détectée depuis l'URL
  if (source && sourceUrl.trim() !== "") detectedFields.push("source");

  const excerpt = text.length > MAX_EXCERPT ? text.slice(0, MAX_EXCERPT) + "…" : text;

  return {
    company,
    position,
    type,
    location,
    remote,
    salary,
    source,
    excerpt,
    detectedFields,
  };
}
