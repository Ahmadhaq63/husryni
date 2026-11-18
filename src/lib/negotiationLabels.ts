import type { Dict } from "./i18n";
import type { RemedyAction } from "./types";

/** Shared by server pages and client components (must not live in a "use client" module). */
export const ACTION_LABEL = (t: Dict): Record<RemedyAction, string> => ({
  none: t.actNone,
  seller_fix: t.actSellerFix,
  price_reduction: t.actPriceReduction,
  hoa: t.actHoa,
  accept: t.actAccept,
});
