import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getPlaceDetails, searchNearby, searchPlaces } from "../dist/src/places-service.js";
import { createPlaceDetailsTool } from "../dist/src/tools/place-details.js";
import plugin from "../dist/index.js";

const originalFetch = globalThis.fetch;
const originalKey = process.env.GOOGLE_PLACES_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = originalKey;
});

function mockFetch(response, inspect) {
  globalThis.fetch = async (url, init) => {
    inspect?.(String(url), init);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

test("text search sends API key, field mask, query, and optional location bias", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  mockFetch({ places: [{ id: "place-1", displayName: { text: "Cafe" }, types: ["cafe"] }] }, (url, init) => {
    assert.equal(url, "https://places.googleapis.com/v1/places:searchText");
    assert.equal(init.headers["X-Goog-Api-Key"], "test-key");
    assert.match(init.headers["X-Goog-FieldMask"], /places\.displayName/);
    assert.deepEqual(JSON.parse(init.body), {
      textQuery: "coffee",
      locationBias: { circle: { center: { latitude: 12, longitude: 34 }, radius: 800 } },
    });
  });
  const result = await searchPlaces("coffee", { latitude: 12, longitude: 34 }, 800);
  assert.equal(result[0].displayName, "Cafe");
  assert.deepEqual(result[0].types, ["cafe"]);
});

test("plugin registers the three public tools", () => {
  const tools = [];
  plugin.register({ registerTool: (factory) => tools.push(factory()) });
  assert.deepEqual(tools.map((tool) => tool.name), [
    "places_search",
    "places_details",
    "places_nearby",
  ]);
});

test("nearby search sends coordinate restriction and optional type", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  mockFetch({ places: [] }, (_url, init) => {
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), {
      locationRestriction: { circle: { center: { latitude: 1, longitude: 2 }, radius: 500 } },
      maxResultCount: 20,
      includedTypes: ["restaurant"],
    });
  });
  assert.deepEqual(await searchNearby(1, 2, "restaurant", 500), []);
});

test("place details encodes its ID and returns untrusted review text safely", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  mockFetch({
    id: "a/b",
    displayName: { text: "Cafe" },
    reviews: [{ authorAttribution: { displayName: "A reviewer" }, rating: 5, text: { text: "Great" } }],
  }, (url, init) => {
    assert.equal(url, "https://places.googleapis.com/v1/places/a%2Fb");
    assert.equal(init.headers["X-Goog-Api-Key"], "test-key");
    assert.match(init.headers["X-Goog-FieldMask"], /reviews/);
  });
  const tool = createPlaceDetailsTool();
  const result = await tool.execute("test", { place_id: "a/b" });
  assert.match(result.content[0].text, /external_data field="review">Great/);
});

test("missing API key fails closed without making a request", async () => {
  delete process.env.GOOGLE_PLACES_API_KEY;
  globalThis.fetch = async () => assert.fail("fetch must not be called without a key");
  await assert.rejects(() => getPlaceDetails("place-1"), /GOOGLE_PLACES_API_KEY/);
});

test("non-success responses surface the HTTP status", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  globalThis.fetch = async () => new Response("", { status: 403, statusText: "Forbidden" });
  await assert.rejects(() => searchNearby(0, 0), /403 Forbidden/);
});
