const { spawn } = require('child_process');
const fs = require('fs');

console.log('Iniciando Cloudflare Tunnel...');
const p = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', 'http://localhost:3000'], { shell: true });

p.stderr.on('data', (data) => {
  const str = data.toString();
  console.error(str);
  const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match) {
    console.log('URL ENCONTRADA:', match[0]);
    fs.writeFileSync('cf_url.txt', match[0]);
  }
});

p.stdout.on('data', (data) => {
  const str = data.toString();
  console.log(str);
  const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match) {
    console.log('URL ENCONTRADA:', match[0]);
    fs.writeFileSync('cf_url.txt', match[0]);
  }
});

p.on('close', (code) => {
  console.log(`Cloudflare tunnel exited with code ${code}, restarting...`);
  setTimeout(() => {
    // restart if closed
  }, 2000);
});

setInterval(() => {}, 100000);
