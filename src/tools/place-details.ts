import { getPlaceDetails } from "../places-service.js";
import type { AnyAgentTool } from "../types.js";
import { textResult, rateLimited, toolExecute, tagExternal, truncate } from "../common.js";

const PlaceDetailsSchema = {
  type: "object",
  properties: { place_id: { type: "string", description: "Google Places ID from search results" } },
  required: ["place_id"],
  additionalProperties: false,
};

export function createPlaceDetailsTool(): AnyAgentTool {
  return {
    name: "places_details",
    label: "Place Details",
    description:
      "Get detailed information about a place including reviews, hours, contact info, and editorial summary.",
    parameters: PlaceDetailsSchema,
    execute: toolExecute("places", "place_details", async (p) => {
      const placeId = (p.place_id as string).trim();

      const place = await rateLimited(() => getPlaceDetails(placeId));

        const name = (place.displayName as { text?: string })?.text ?? placeId;
        const lines: string[] = [];
        lines.push(`## ${tagExternal("name", name)}`);
        if (place.formattedAddress) lines.push(`- **Address:** ${tagExternal("address", place.formattedAddress)}`);
        if (place.rating !== undefined) {
          lines.push(
            `- **Rating:** ${place.rating}/5 (${place.userRatingCount ?? 0} reviews)`
          );
        }
        if (place.priceLevel) lines.push(`- **Price:** ${place.priceLevel}`);
        if (place.nationalPhoneNumber) lines.push(`- **Phone:** ${place.nationalPhoneNumber}`);
        if (place.websiteUri) lines.push(`- **Website:** ${place.websiteUri}`);
        if (place.googleMapsUri) lines.push(`- **Maps:** ${place.googleMapsUri}`);
        if (place.types) lines.push(`- **Types:** ${(place.types as string[]).join(", ")}`);

        const summary = place.editorialSummary as { text?: string } | undefined;
        if (summary?.text) {
          lines.push(`\n**Summary:** ${tagExternal("summary", summary.text)}`);
        }

        const hours = place.regularOpeningHours as { weekdayDescriptions?: string[] } | undefined;
        if (hours?.weekdayDescriptions) {
          lines.push(`\n**Hours:**`);
          for (const day of hours.weekdayDescriptions) {
            lines.push(`- ${tagExternal("hours", day)}`);
          }
        }

        const reviews = place.reviews as Array<{
          authorAttribution?: { displayName?: string };
          rating?: number;
          text?: { text?: string };
          relativePublishTimeDescription?: string;
        }> | undefined;

        if (reviews && reviews.length > 0) {
          lines.push(`\n**Reviews (${reviews.length}):**`);
          for (const review of reviews.slice(0, 5)) {
            const author = tagExternal("reviewer", review.authorAttribution?.displayName ?? "Anonymous");
            const rating = review.rating ? `${"*".repeat(review.rating)}` : "";
            const text = review.text?.text ?? "";
            const when = review.relativePublishTimeDescription ?? "";
            const preview = truncate(text, 200);
            lines.push(`\n> **${author}** ${rating} ${when}`);
            if (preview) lines.push(`> ${tagExternal("review", preview)}`);
          }
        }

      console.error(`[places] details ${placeId} "${name}"`);

      return textResult(lines.join("\n"), { placeId, name });
    }),
  };
}
