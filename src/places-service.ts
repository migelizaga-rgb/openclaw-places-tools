import { getApiKey, PLACES_BASE_URL } from "./types.js";

export interface PlaceResult {
  id: string;
  displayName: string;
  formattedAddress: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types: string[];
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { weekdayDescriptions: string[] };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
}

interface PlacesApiResponse {
  places?: Array<Record<string, unknown>>;
}

interface PlaceDetailsApiResponse extends Record<string, unknown> {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  reviews?: Array<{
    authorAttribution?: { displayName?: string };
    rating?: number;
    text?: { text?: string };
    relativePublishTimeDescription?: string;
  }>;
  editorialSummary?: { text?: string };
}

async function placesApiFetch(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), ...init });
  if (!res.ok) {
    throw Object.assign(new Error(`Places API error: ${res.status} ${res.statusText}`), { code: res.status });
  }
  return res.json();
}

function mapPlace(raw: Record<string, unknown>): PlaceResult {
  const displayName = raw.displayName as { text?: string } | undefined;
  const location = raw.location as { latitude: number; longitude: number } | undefined;
  const hours = raw.regularOpeningHours as { weekdayDescriptions?: string[] } | undefined;

  return {
    id: (raw.id as string) ?? "",
    displayName: displayName?.text ?? "",
    formattedAddress: (raw.formattedAddress as string) ?? "",
    rating: raw.rating as number | undefined,
    userRatingCount: raw.userRatingCount as number | undefined,
    priceLevel: raw.priceLevel as string | undefined,
    types: (raw.types as string[]) ?? [],
    location,
    regularOpeningHours: hours?.weekdayDescriptions
      ? { weekdayDescriptions: hours.weekdayDescriptions }
      : undefined,
    websiteUri: raw.websiteUri as string | undefined,
    nationalPhoneNumber: raw.nationalPhoneNumber as string | undefined,
    googleMapsUri: raw.googleMapsUri as string | undefined,
  };
}

const SEARCH_FIELDS =
  "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.types,places.location,places.regularOpeningHours,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri";

const DETAILS_FIELDS =
  "id,displayName,formattedAddress,rating,userRatingCount,priceLevel,types,location,regularOpeningHours,websiteUri,nationalPhoneNumber,googleMapsUri,reviews,editorialSummary";

export async function searchPlaces(
  query: string,
  location?: { latitude: number; longitude: number },
  radius?: number
): Promise<PlaceResult[]> {
  const apiKey = getApiKey();

  const body: Record<string, unknown> = { textQuery: query };
  if (location) {
    body.locationBias = {
      circle: {
        center: location,
        radius: radius ?? 5000,
      },
    };
  }

  const data = (await placesApiFetch(`${PLACES_BASE_URL}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": SEARCH_FIELDS,
    },
    body: JSON.stringify(body),
  })) as PlacesApiResponse;
  return (data.places ?? []).map(mapPlace);
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsApiResponse> {
  const apiKey = getApiKey();

  return (await placesApiFetch(`${PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": DETAILS_FIELDS,
    },
  })) as PlaceDetailsApiResponse;
}

export async function searchNearby(
  latitude: number,
  longitude: number,
  type?: string,
  radius?: number
): Promise<PlaceResult[]> {
  const apiKey = getApiKey();

  const body: Record<string, unknown> = {
    locationRestriction: {
      circle: {
        center: { latitude, longitude },
        radius: radius ?? 1000,
      },
    },
    maxResultCount: 20,
  };

  if (type) {
    body.includedTypes = [type];
  }

  const data = (await placesApiFetch(`${PLACES_BASE_URL}/places:searchNearby`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": SEARCH_FIELDS,
    },
    body: JSON.stringify(body),
  })) as PlacesApiResponse;
  return (data.places ?? []).map(mapPlace);
}
