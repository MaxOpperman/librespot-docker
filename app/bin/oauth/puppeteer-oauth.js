require('dotenv').config();
const fs = require('fs');
const { spawn } = require("child_process");
const puppeteer = require('puppeteer');

const email = process.env.SPOTIFY_OAUTH_EMAIL;
const password = process.env.SPOTIFY_OAUTH_PWD;

// start librespot
const cp = spawn('bash', ['run-librespot.sh'], {
  stdio: ['pipe', 'inherit', 'inherit'],
  env: { ...process.env },
});

// if the oauth automation is enabled, use puppeteer to run it
// otherwise, just leave the app to the user
if (process.env.AUTO_OAUTH) {
  // first sleep for 3 seconds to allow librespot to start
  setTimeout(spotifyLogin, 3000);
}

async function spotifyLogin() {
  // Read oauth.txt
  const logData = fs.readFileSync('oauth.txt', 'utf8');

  // Extract OAuth URL
  const urlMatch = logData.match(/https:\/\/accounts\.spotify\.com\/authorize[^\s]*/);

  if (!urlMatch) {
    console.log(logData);
    console.error("OAuth URL not found in console output");
    process.exit(1);
  }

  const oauthUrl = urlMatch[0];
  // true to run headless, or false for debugging
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  // Navigate to the Spotify login URL (replace with your dynamic URL)
  await page.goto(oauthUrl, { waitUntil: 'networkidle0' });

  // Wait for the login form to load
  await page.waitForSelector('input#login-username');  // Wait for the username input field to be visible

  // Type the username and password into the fields
  await page.type('input#login-username', email); // Enter your email
  await page.type('input#login-password', password); //Enter your password

  // Click the login button
  await page.click('button#login-button');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  // Wait for the "Continue to the app" button to appear
  await page.waitForSelector('button[data-testid="auth-accept"]');

  // print the URL
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');
  client.on('Network.requestWillBeSent', (e) => {
    if (e.request.url.includes("http://127.0.0.1")) {
      cp.stdin.write(e.request.url);
    }
  });

  // Approve the app
  await page.click('button[data-testid="auth-accept"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  // Close the browser
  await browser.close();
  cp.stdin.end();
}
