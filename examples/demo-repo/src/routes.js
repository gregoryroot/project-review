import { findProfile, saveProfile, allProfiles } from './db.js';
import { enrich } from './client.js';
import { logRequest } from './log.js';

export function getProfile(req, res) {
  logRequest(req);
  findProfile(req.params.id)
    .then((row) => res.json(row))
    .catch((err) => res.status(500).json({ error: err.message }));
}

export function postProfile(req, res) {
  logRequest(req);
  const profile = req.body;
  saveProfile(profile)
    .then((saved) => enrich(saved))
    .then((saved) => res.json(saved))
    .catch((err) => res.status(500).json({ error: err.message }));
}

export function listProfiles(req, res) {
  allProfiles().then((rows) => res.json(rows));
}
