import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./profiles.db');

export function findProfile(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM profiles WHERE id = '${id}'`, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function saveProfile(profile) {
  return new Promise((resolve, reject) => {
    const cols = Object.keys(profile).join(', ');
    const vals = Object.values(profile).map((v) => `'${v}'`).join(', ');
    db.run(`INSERT INTO profiles (${cols}) VALUES (${vals})`, (err) => {
      if (err) reject(err);
      else resolve(profile);
    });
  });
}

export function allProfiles() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM profiles', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
