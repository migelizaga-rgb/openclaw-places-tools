import { searchPlaces } from "../places-service.js";
import type { AnyAgentTool } from "../types.js";
import { textResult, rateLimited, toolExecute, tagExternal } from "../common.js";

const SearchPlacesSchema = {
  type: "object",
  properties: {
    query: { type: "string", description: "Text search query, such as a place type, name, or area." },
    latitude: { type: "number", description: "Latitude to bias results toward" },
    longitude: { type: "number", description: "Longitude to bias results toward" },
    radius: { type: "number", description: "Search radius in meters", minimum: 1, maximum: 50000 },
  },
  required: ["query"],
  additionalProperties: false,
};

export function createSearchPlacesTool(): AnyAgentTool {
  return {
    name: "places_search",
    label: "Search Places",
    description:
      "Search for places using Google Places API. Returns name, address, rating, hours, and price level.",
    parameters: SearchPlacesSchema,
    execute: toolExecute("places", "search", async (p) => {
      const query = (p.query as string).trim();
      const latitude = p.latitude as number | undefined;
      const longitude = p.longitude as number | undefined;
      const radius = p.radius as number | undefined;

      const location =
        latitude !== undefined && longitude !== undefined
          ? { latitude, longitude }
          : undefined;

      const places = await rateLimited(() => searchPlaces(query, location, radius));

      if (places.length === 0) {
        return textResult(`No places found for: ${query}`);
      }

      const lines: string[] = [];
      lines.push(`## Places Search Results`);
      lines.push(`**Query:** ${query}`);
      lines.push(`**Found:** ${places.length} places\n`);

      for (const place of places) {
        lines.push(`### ${tagExternal("name", place.displayName)}`);
        lines.push(`- **Address:** ${tagExternal("address", place.formattedAddress)}`);
        if (place.rating !== undefined) {
          lines.push(
            `- **Rating:** ${place.rating}/5 (${place.userRatingCount ?? 0} reviews)`
          );
        }
        if (place.priceLevel) lines.push(`- **Price:** ${place.priceLevel}`);
        if (place.nationalPhoneNumber) lines.push(`- **Phone:** ${place.nationalPhoneNumber}`);
        if (place.websiteUri) lines.push(`- **Website:** ${place.websiteUri}`);
        if (place.googleMapsUri) lines.push(`- **Maps:** ${place.googleMapsUri}`);
        if (place.regularOpeningHours) {
          lines.push(`- **Hours:** ${place.regularOpeningHours.weekdayDescriptions[0]} ...`);
        }
        lines.push(`- **Place ID:** ${place.id}`);
        lines.push("");
      }

      console.error(
        `[places] search q="${query}" found=${places.length}`
      );

      return textResult(lines.join("\n"), {
        count: places.length,
        query,
      });
    }),
  };
}
