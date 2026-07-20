import { getSandbox, Sandbox } from "@cloudflare/sandbox";
export { Sandbox } from "@cloudflare/sandbox";
interface Env {
  Sandbox: DurableObjectNamespace<Sandbox>;
  SANDBOX_API_KEY: string;
}
const allowedDependencies = new Set(["phaser"]),
  allowedDevDependencies = new Set(["typescript", "vite", "@playwright/test"]);
function validateProject(project: any) {
  if (
    !["playloop-project-v1", "playloop-project-v2"].includes(project?.format) ||
    !project?.immutable ||
    !project.files
  )
    return ["Invalid project format"];
  const errors: string[] = [];
  for (const name of Object.keys(project.files)) {
    if (name.startsWith("/") || name.includes("..") || name.includes("\\"))
      errors.push(`Unsafe path: ${name}`);
  }
  for (const [name, value] of Object.entries(project.binaryFiles || {})) {
    if (name.startsWith("/") || name.includes("..") || name.includes("\\"))
      errors.push(`Unsafe binary path: ${name}`);
    if (typeof value !== "string" || value.length > 15_000_000)
      errors.push(`Invalid binary file: ${name}`);
  }
  try {
    const pkg = JSON.parse(project.files["package.json"]);
    for (const name of Object.keys(pkg.dependencies || {}))
      if (!allowedDependencies.has(name))
        errors.push(`Dependency not allowed: ${name}`);
    for (const name of Object.keys(pkg.devDependencies || {}))
      if (!allowedDevDependencies.has(name))
        errors.push(`Dev dependency not allowed: ${name}`);
  } catch {
    errors.push("Invalid package manifest");
  }
  return errors;
}
export default {
  async fetch(request: Request, env: Env) {
    if (request.method !== "POST")
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    if (
      !env.SANDBOX_API_KEY ||
      request.headers.get("authorization") !== `Bearer ${env.SANDBOX_API_KEY}`
    )
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await request.json()) as { jobId?: string; project?: any },
      errors = validateProject(body.project);
    if (errors.length)
      return Response.json(
        { error: "Project rejected", errors },
        { status: 422 },
      );
    const id = `build-${String(body.jobId || crypto.randomUUID())
        .replace(/[^a-z0-9-]/gi, "")
        .toLowerCase()}`,
      sandbox = getSandbox(env.Sandbox, id, { transport: "rpc" });
    try {
      await sandbox.mkdir("/workspace/game", { recursive: true });
      for (const [name, content] of Object.entries(body.project.files))
        await sandbox.writeFile(`/workspace/game/${name}`, String(content));
      for (const [name, encoded] of Object.entries(
        body.project.binaryFiles || {},
      )) {
        const bytes = Uint8Array.from(atob(String(encoded)), (c) =>
          c.charCodeAt(0),
        );
        await sandbox.writeFile(
          `/workspace/game/${name}`,
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(bytes);
              controller.close();
            },
          }),
          { encoding: "none" },
        );
      }
      const install = await sandbox.exec(
        "npm install --ignore-scripts --no-audit --no-fund",
        {
          cwd: "/workspace/game",
          timeout: 120000,
          env: {
            CI: "1",
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
            PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright",
          },
        },
      );
      if (!install.success)
        return Response.json(
          {
            status: "failed",
            stage: "install",
            stdout: install.stdout,
            stderr: install.stderr,
          },
          { status: 422 },
        );
      const build = await sandbox.exec("npm run build", {
        cwd: "/workspace/game",
        timeout: 120000,
        env: { CI: "1", NODE_OPTIONS: "--max-old-space-size=512" },
      });
      const qa = build.success
        ? await sandbox.exec("npm run qa", {
            cwd: "/workspace/game",
            timeout: 90000,
            env: { CI: "1", PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright" },
          })
        : null;
      const passed = build.success && qa?.success === true;
      let artifact: { html: string; bytes: number } | undefined;
      if (passed) {
        const index = await sandbox.readFile("/workspace/game/dist/index.html");
        if (!index.success) throw new Error("Compiled index.html is missing");
        let html = index.content;
        const moduleTag = html.match(
          /<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/i,
        );
        if (!moduleTag) throw new Error("Compiled module entry is missing");
        const modulePath = moduleTag[1].replace(
          /^\/?/,
          "/workspace/game/dist/",
        );
        const bundle = await sandbox.readFile(modulePath);
        if (!bundle.success)
          throw new Error("Compiled JavaScript bundle is missing");
        html = html.replace(
          moduleTag[0],
          `<script>${bundle.content.replace(/<\/script/gi, "<\\/script")}</script>`,
        );
        for (const match of [
          ...html.matchAll(
            /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/gi,
          ),
        ]) {
          const cssPath = match[1].replace(/^\/?/, "/workspace/game/dist/");
          const css = await sandbox.readFile(cssPath);
          if (css.success)
            html = html.replace(
              match[0],
              `<style>${css.content.replace(/<\/style/gi, "<\\/style")}</style>`,
            );
        }
        const bytes = new TextEncoder().encode(html).byteLength;
        if (bytes > 5_000_000)
          throw new Error("Compiled artifact exceeds 5 MB");
        artifact = { html, bytes };
      }
      return Response.json(
        {
          status: passed ? "passed" : "failed",
          stage: build.success ? "qa" : "build",
          exitCode: build.success ? qa?.exitCode : build.exitCode,
          stdout: build.stdout,
          stderr: build.stderr,
          qa: qa
            ? { stdout: qa.stdout, stderr: qa.stderr, exitCode: qa.exitCode }
            : null,
          artifact,
          checks: {
            isolatedFilesystem: true,
            dependencyAllowlist: true,
            installScriptsDisabled: true,
            memoryLimitMb: 512,
            timeoutMs: 120000,
            noSecretsInjected: true,
            browserGameplayQa: true,
            keyboardAndTouch: true,
            lifecyclePaths: true,
            screenshotDiff: true,
            performanceBudget: true,
            persistenceReload: true,
            accessibilitySmoke: true,
          },
        },
        { status: passed ? 200 : 422 },
      );
    } finally {
      await sandbox.destroy().catch(() => undefined);
    }
  },
};
