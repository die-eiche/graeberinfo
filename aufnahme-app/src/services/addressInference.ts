import { UNCERTAIN_MARK } from "./allowedValues";

const SAME_ADDRESS_RE =
  /\b(gleiche|selbe|dieselbe|identische)\s+adresse\b|\badresse\s+(wie|vom|des)\s+(der\s+)?mieter|\b(wohnt|wohnte|wohnhaft)\s+(auch\s+)?(dort|da)\b|\b(verstorbene[rn]?)\s+.*(gleiche|selbe)\s+(anschrift|adresse)\b/i;

export function transcriptImpliesSameAddress(transcript: string): boolean {
  return SAME_ADDRESS_RE.test(transcript);
}

/**
 * Übernimmt Mieter-Adresse auf Verstorbenen, wenn laut Transkript gleich
 * oder Verstorbenen-Adresse ausdrücklich als Kopie markiert werden soll.
 * Überschreibt keine bereits gesetzten Verstorbenen-Adressfelder.
 */
export function applySameAddressFromTenant(
  fields: Record<string, string>,
  transcript: string
): Record<string, string> {
  if (!transcriptImpliesSameAddress(transcript)) {
    return fields;
  }

  const next = { ...fields };
  const tenantStreet = (next["Mieter Straße"] ?? "").trim();
  const tenantPlzOrt = (next["Mieter PLZ Ort"] ?? "").trim();
  const deceasedStreet = (next["Verstorbener Straße"] ?? "").trim();
  const deceasedPlzOrt = (next["Verstorbener PLZ Ort"] ?? "").trim();

  if (
    tenantStreet &&
    tenantStreet !== UNCERTAIN_MARK &&
    (!deceasedStreet || deceasedStreet === UNCERTAIN_MARK)
  ) {
    next["Verstorbener Straße"] = tenantStreet;
  }
  if (
    tenantPlzOrt &&
    tenantPlzOrt !== UNCERTAIN_MARK &&
    (!deceasedPlzOrt || deceasedPlzOrt === UNCERTAIN_MARK)
  ) {
    next["Verstorbener PLZ Ort"] = tenantPlzOrt;
  }
  return next;
}
