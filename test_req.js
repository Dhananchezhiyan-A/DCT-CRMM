const http = require('http');

const data = JSON.stringify({ email: 'admin@dctcrm.com', password: 'password123' });

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body.substring(0, 300));
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(data);
req.end();
