/**
 * Vercel Speed Insights initialization
 * This file loads and initializes Vercel Speed Insights for performance monitoring.
 */

import { injectSpeedInsights } from '../node_modules/@vercel/speed-insights/dist/index.mjs';

// Initialize Speed Insights
// This will automatically track page performance metrics
// Note: Speed Insights only tracks data in production (when deployed to Vercel)
injectSpeedInsights({
  debug: false // Set to true to see events in console during development
});
