import { searchAddresses } from "@/lib/addressIndex";
import { addressDb } from "@/lib/server/addressDb";

// Address suggestions for the order form. Searches the local copy of the official register
// (Staðfangaskrá, HMS), so what people type never leaves this server.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  try {
    const db = addressDb();
    if (db) {
      const suggestions = searchAddresses(db, params.get("q") ?? "", { postcode: params.get("pc"), limit: 8 });
      return Response.json({ available: true, suggestions }, { headers: { "Cache-Control": "private, max-age=3600" } });
    }
  } catch (e) {
    console.error("Address suggestions failed:", e);
  }
  // No index (npm run addresses hasn't been run) or a broken one: the form works as a plain text field.
  return Response.json({ available: false, suggestions: [] }, { headers: { "Cache-Control": "no-store" } });
}
