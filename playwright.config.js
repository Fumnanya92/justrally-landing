module.exports = {
  testDir: './sign',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  workers: 1,
  use: {
    channel: 'chrome',
    headless: true,
  },
  webServer: {
    command: 'python3 -m http.server 4179 --bind 127.0.0.1',
    port: 4179,
    reuseExistingServer: true,
  },
};
