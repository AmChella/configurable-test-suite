import { defineConfig, devices } from "@playwright/test";
import * as path from "path";
import dotenv from "dotenv";

// Load environment variables based on the 'ENV' flag
dotenv.config({
  path: path.resolve(__dirname, "configs", `${process.env.ENV || "dev"}.env`),
});

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  timeout: 60 * 1000,
  use: {
    baseURL: process.env.BASE_URL,
    trace: "on-first-retry",
    headless: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },
    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },
  ],
});
