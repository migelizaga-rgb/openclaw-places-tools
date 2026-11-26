import type { OpenClawPluginApi } from "./src/types.js";
import { createSearchPlacesTool } from "./src/tools/search-places.js";
import { createPlaceDetailsTool } from "./src/tools/place-details.js";
import { createNearbyPlacesTool } from "./src/tools/nearby-places.js";

export default {
  register(api: OpenClawPluginApi) {
    api.registerTool(() => createSearchPlacesTool());
    api.registerTool(() => createPlaceDetailsTool());
    api.registerTool(() => createNearbyPlacesTool());
  },
};
