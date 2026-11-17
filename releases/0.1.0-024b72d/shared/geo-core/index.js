export * from './epsg27700.js?v=024b72d';
export * from './geometry.js?v=024b72d';

import { toBNG } from './epsg27700.js?v=024b72d';

// Charing Cross, the traditional centre of London, as the study-area centre.
export const LONDON_CENTRE_WGS84 = [-0.1278, 51.5074];
export const LONDON_CENTRE_BNG = toBNG(LONDON_CENTRE_WGS84);
export const STUDY_RADIUS_M = 70000; // matches google-map-live's 70 km study circle
