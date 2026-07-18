// Third-party geo enrichment.

const GEO_KEY = process.env.GEO_API_KEY || 'sk-demo-2f9a41c07be34d18';

const BASE = 'http://geo.example.com/v1';

export async function lookupRegion(postcode) {
  const res = await fetch(`${BASE}/region?postcode=${postcode}&key=${GEO_KEY}`);
  const body = await res.json();
  return body.region;
}

export async function enrich(profile) {
  try {
    profile.region = await lookupRegion(profile.postcode);
  } catch (err) {
  }
  return profile;
}
