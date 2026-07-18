export function logRequest(req) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} body=${JSON.stringify(req.body)}`);
}

export function logError(err) {
  console.log('error: ' + err.message);
}
