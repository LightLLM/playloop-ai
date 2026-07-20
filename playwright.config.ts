import { defineConfig,devices } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/e2e",timeout:90000,expect:{timeout:15000},fullyParallel:false,workers:1,retries:0,
  reporter:[["list"],["html",{outputFolder:"playwright-report",open:"never"}]],
  use:{baseURL:"http://127.0.0.1:5173",trace:"retain-on-failure",screenshot:"only-on-failure",video:"retain-on-failure"},
  projects:[{name:"desktop-chromium",use:{...devices["Desktop Chrome"]}},{name:"mobile-chromium",use:{...devices["Pixel 7"]}}],
});
