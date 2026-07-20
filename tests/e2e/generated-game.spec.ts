import { expect, test } from "@playwright/test";

test("prompt, approve, build, launch, play and restart without runtime errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith("Failed to load resource")
    )
      errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    const expectedFallback =
      (response.url().includes("/api/sandbox-build") &&
        response.status() === 503) ||
      (response.url().includes("/api/assets") &&
        [429, 502, 503].includes(response.status()));
    if (
      response.status() >= 400 &&
      !response.url().endsWith(".woff2") &&
      !expectedFallback
    )
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  await page.waitForFunction(() =>
    Object.keys(document.querySelector("textarea") || {}).some((key) =>
      key.startsWith("__reactProps"),
    ),
  );
  await page
    .getByRole("textbox")
    .fill("A snake game in a neon forest where a fox eats glowing fruit");
  await expect(
    page.getByRole("button", { name: /Compile game/ }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /Compile game/ }).click();
  await expect(
    page.getByRole("button", { name: /Generate approved plan/ }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /Generate approved plan/ }).click();
  await expect(page.getByText("PLAN AWAITING APPROVAL")).toBeVisible();
  await expect(page.getByText(/Snake arcade/i)).toBeVisible();
  await page.getByRole("button", { name: /Approve & build/ }).click();
  await expect(page.locator("iframe.game-sandbox")).toBeVisible({
    timeout: 60000,
  });
  const game = page.frameLocator("iframe.game-sandbox");
  await expect(game.locator("canvas#game")).toBeVisible();
  await expect(page.getByText("RUNTIME HEALTHY")).toBeVisible();
  if (testInfo.project.name.includes("mobile"))
    await game.getByRole("button", { name: "→" }).tap();
  else {
    await page.locator("iframe.game-sandbox").focus();
    await page.keyboard.press("ArrowRight");
  }
  await page.locator("iframe.game-sandbox").focus();
  await page.keyboard.press("KeyR");
  await expect(page.getByText("RESTARTED")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("generated-game.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
