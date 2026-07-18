import express from 'express';
import { getProfile, postProfile, listProfiles } from './routes.js';

const app = express();
app.use(express.json());

app.get('/api/profile/:id', getProfile);
app.post('/api/profile', postProfile);
app.get('/api/profiles', listProfiles);

app.listen(3000, () => console.log('listening on 3000'));
