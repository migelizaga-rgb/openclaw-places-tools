import { searchNearby } from "../places-service.js";
import type { AnyAgentTool } from "../types.js";
import { textResult, rateLimited, toolExecute, tagExternal } from "../common.js";

const NearbyPlacesSchema = {
  type: "object",
  properties: {
    latitude: { type: "number", description: "Latitude of the center point" },
    longitude: { type: "number", description: "Longitude of the center point" },
    type: { type: "string", description: "Optional Google place type filter" },
    radius: { type: "number", description: "Search radius in meters", minimum: 1, maximum: 50000 },
  },
  required: ["latitude", "longitude"],
  additionalProperties: false,
};

export function createNearbyPlacesTool(): AnyAgentTool {
  return {
    name: "places_nearby",
    label: "Nearby Places",
    description:
      "Search for places near a specific location by coordinates and optional type filter.",
    parameters: NearbyPlacesSchema,
    execute: toolExecute("places", "nearby_places", async (p) => {
      const latitude = p.latitude as number;
      const longitude = p.longitude as number;
      const type = p.type as string | undefined;
      const radius = p.radius as number | undefined;

      const places = await rateLimited(() => searchNearby(latitude, longitude, type, radius));

      if (places.length === 0) {
        return textResult(
          `No places found near (${latitude}, ${longitude})${type ? ` of type "${type}"` : ""}`
        );
      }

      const lines: string[] = [];
      lines.push(`## Nearby Places`);
      lines.push(`**Location:** (${latitude}, ${longitude})`);
      if (type) lines.push(`**Type:** ${type}`);
      lines.push(`**Radius:** ${radius ?? 1000}m`);
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
        if (place.googleMapsUri) lines.push(`- **Maps:** ${place.googleMapsUri}`);
        lines.push(`- **Place ID:** ${place.id}`);
        lines.push("");
      }

      console.error(
        `[places] nearby (${latitude},${longitude}) type=${type ?? "any"} radius=${radius ?? 1000} found=${places.length}`
      );

      return textResult(lines.join("\n"), {
        count: places.length,
        latitude,
        longitude,
        type: type ?? null,
        radius: radius ?? 1000,
      });
    }),
  };
}
