const { spawn } = require('child_process');
const fs = require('fs');

const SUBDOMAIN = 'trading-demo-saul';

function startTunnel() {
  console.log('Iniciando localtunnel con subdominio fijo...');
  const p = spawn('npx', ['localtunnel', '--port', '3000', '--subdomain', SUBDOMAIN], { shell: true });

  p.stdout.on('data', (data) => {
    const str = data.toString();
    console.log(str);
    if (str.includes('your url is:')) {
      const match = str.match(/https:\/\/[^\s]+/);
      if (match) {
        fs.writeFileSync('tunnel_url.txt', match[0]);
      }
    }
  });

  p.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  p.on('close', (code) => {
    console.log(`Túnel cerrado con código ${code}, reiniciando en 2s...`);
    setTimeout(startTunnel, 2000);
  });
}

startTunnel();

// Mantener proceso activo en Node
setInterval(() => {}, 100000);
