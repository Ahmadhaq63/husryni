import "server-only";
import { negotiableFindings, negotiationOpen } from "../negotiation";
import { getNegotiationByToken, getRemedy } from "../negotiationRepo";
import { getBundle } from "../repo";
import type { Finding, InspectionBundle, Negotiation, Remedy } from "../types";
import { fail, LOCKED, NOT_FOUND } from "./http";

type Err = { error: Response };

/** Buyer side: the inspection link is the capability; the report must be final. */
export function loadForBuyer(inspectionId: string): Err | { bundle: InspectionBundle } {
  const bundle = getBundle(inspectionId);
  if (!bundle) return { error: fail(404, NOT_FOUND) };
  if (!negotiationOpen(bundle.inspection.status)) return { error: fail(409, LOCKED) };
  return { bundle };
}

export function negotiableFinding(bundle: InspectionBundle, findingId: string): Finding | null {
  return negotiableFindings(bundle).find((f) => f.id === findingId) ?? null;
}

/** Seller side: the share token is the capability. Only items the buyer actually requested are reachable. */
export function loadForSeller(
  token: string,
  findingId?: string,
): Err | { negotiation: Negotiation; bundle: InspectionBundle; finding: Finding | null; remedy: Remedy | null } {
  const negotiation = getNegotiationByToken(token);
  if (!negotiation) return { error: fail(404, NOT_FOUND) };
  const bundle = getBundle(negotiation.inspectionId);
  if (!bundle || !negotiationOpen(bundle.inspection.status)) return { error: fail(404, NOT_FOUND) };
  if (!findingId) return { negotiation, bundle, finding: null, remedy: null };
  const finding = negotiableFinding(bundle, findingId);
  const remedy = finding ? getRemedy(finding.id) : null;
  if (!finding || !remedy || remedy.action === "none") return { error: fail(404, NOT_FOUND) };
  return { negotiation, bundle, finding, remedy };
}
