// Shares the built app (APK) over your Wi-Fi so the phone can download and install it without a
// USB cable: run it, scan the QR code with the phone's camera, tap Download, then Install.
// Usage: node scripts/serve-apk.mjs [path-to-apk]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createSocket } from 'node:dgram';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The QR code is a nice-to-have: without the package, the address is still printed.
const qrcode = await import('qrcode-terminal').then((m) => m.default ?? m).catch(() => null);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apk = resolve(process.argv[2] ?? `${root}/android/app/build/outputs/apk/release/app-release.apk`);
const PORT = Number(process.env.PORT ?? 8737);

if (!existsSync(apk)) {
  console.error(`\nCould not find the app file:\n  ${apk}\nBuild it first (install-without-usb.bat does that).`);
  process.exit(1);
}
const size = statSync(apk).size;

/**
 * The address this computer uses on your Wi-Fi: the one its traffic to the internet goes out of.
 * (Connecting a UDP socket sends nothing; it just asks the system which interface it would use.)
 */
function primaryAddress() {
  return new Promise((resolveIp) => {
    const socket = createSocket('udp4');
    socket.on('error', () => resolveIp(null));
    try {
      socket.connect(53, '8.8.8.8', () => {
        const ip = socket.address().address;
        socket.close();
        resolveIp(ip && ip !== '0.0.0.0' ? ip : null);
      });
    } catch {
      resolveIp(null);
    }
  });
}

/** Virtual adapters (VirtualBox, Docker/WSL/Hyper-V) that a phone can never reach. */
const isVirtual = (ip) => ip.startsWith('192.168.56.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

/** This computer's addresses on the local network, the Wi-Fi one first and virtual ones last. */
async function lanAddresses() {
  const all = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
  const primary = await primaryAddress();
  const rank = (ip) =>
    ip === primary ? -1 : isVirtual(ip) ? 9 : ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2;
  return [...new Set(all)].sort((a, b) => rank(a) - rank(b));
}

const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Install Workout</title><style>
body{font-family:system-ui,sans-serif;background:#0F1115;color:#F3F4F6;margin:0;padding:24px;line-height:1.45}
a.btn{display:block;text-align:center;background:#22C55E;color:#fff;font-weight:700;font-size:20px;padding:18px;border-radius:14px;text-decoration:none;margin:20px 0}
li{margin:8px 0}small{color:#9CA3AF}</style></head><body>
<h1>Workout app update</h1>
<a class="btn" href="/workout.apk">Download the app (${(size / 1048576).toFixed(0)} MB)</a>
<ol><li>Tap <b>Download</b> above, then open the downloaded file.</li>
<li>If Android asks, allow your browser to <b>install unknown apps</b> (only needed the first time).</li>
<li>Tap <b>Update</b> / <b>Install</b>. It installs over your current app and <b>keeps your workouts</b>.</li></ol>
<small>Don't uninstall the old app first: that would delete its data.</small></body></html>`;

let downloads = 0;
let pageSeen = false;
const server = createServer((req, res) => {
  if (req.url === '/workout.apk') {
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': size,
      'Content-Disposition': 'attachment; filename="Workout.apk"',
    });
    const stream = createReadStream(apk);
    stream.pipe(res);
    res.on('finish', () => {
      downloads++;
      console.log(`\n✔ The phone downloaded the app (${downloads}). Install it on the phone; you can close this window afterwards.`);
    });
    return;
  }
  if (!pageSeen) console.log('\n✔ Your phone reached this computer - tap Download on the phone.');
  pageSeen = true;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `\nPort ${PORT} is busy: is this window already open somewhere?` : e);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', async () => {
  const ips = await lanAddresses();
  if (ips.length === 0) {
    console.error('\nThis computer is not on a network. Connect it to the same Wi-Fi as your phone.');
    process.exit(1);
  }
  const url = `http://${ips[0]}:${PORT}/`;
  console.log('\nScan this with your phone camera (phone and computer on the same Wi-Fi):\n');
  if (qrcode) qrcode.generate(url, { small: true });
  else console.log('  (QR code unavailable - type the address below into the phone instead)');
  console.log(`\nOr type this address into the phone's browser:  ${url}`);
  if (ips.length > 1) console.log(`If that doesn't open, try: ${ips.slice(1).map((ip) => `http://${ip}:${PORT}/`).join('  ')}`);
  console.log('\nKeep this window open until the phone has downloaded the app.');
  console.log('If the page keeps loading on the phone:');
  console.log('  - make sure the phone is on the same Wi-Fi as this computer (not mobile data or a guest network);');
  console.log('  - or skip the Wi-Fi: send yourself Workout.apk from this folder (email / Google Drive) and open it on the phone.\n');
});
