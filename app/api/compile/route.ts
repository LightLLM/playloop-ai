import { env } from "cloudflare:workers";
import {
  compileGameSpec,
  validateGameSpec,
  GameTemplate,
} from "../../game-engine.mjs";
import { actorFor, consumeQuota } from "../../security.mjs";

type CompileRequest = { prompt?: string; template?: "auto" | GameTemplate };
type Enrichment = {
  title: string;
  objective: string;
  theme: string;
  hero: string;
  palette: string[];
  environment_prompt: string;
  hero_prompt: string;
  prop_prompt: string;
};

const enrichmentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    objective: { type: "string" },
    theme: { type: "string" },
    hero: { type: "string" },
    palette: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    },
    environment_prompt: { type: "string" },
    hero_prompt: { type: "string" },
    prop_prompt: { type: "string" },
  },
  required: [
    "title",
    "objective",
    "theme",
    "hero",
    "palette",
    "environment_prompt",
    "hero_prompt",
    "prop_prompt",
  ],
};

function readOutputText(payload: any) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output || [])
    for (const content of item.content || [])
      if (content.type === "output_text" && content.text) return content.text;
  return "";
}

export async function POST(request: Request) {
  const body = (await request.json()) as CompileRequest;
  const prompt = body.prompt?.trim() || "";
  if (prompt.length < 10)
    return Response.json(
      { error: "Describe the game in at least 10 characters." },
      { status: 400 },
    );
  const actor = await actorFor(request);
  if (!actor)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  const quota = await consumeQuota(actor.ownerId, "compile", 30);
  if (!quota.ok)
    return Response.json(
      { error: "Daily planning quota reached" },
      { status: 429, headers: { "retry-after": String(quota.retryAfter) } },
    );
  const base = compileGameSpec(prompt, body.template || "auto");
  const apiKey = (env as any).OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey)
    return Response.json({
      spec: base,
      compiler: "deterministic",
      warning: "AI enrichment is not configured.",
    });

  try {
    const moderation = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: prompt }),
    });
    if (!moderation.ok)
      throw new Error(`Moderation request failed: ${moderation.status}`);
    if (((await moderation.json()) as any).results?.[0]?.flagged)
      return Response.json(
        {
          error: "This game idea cannot be generated safely. Please revise it.",
        },
        { status: 422 },
      );
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model:
          (env as any).OPENAI_MODEL ||
          process.env.OPENAI_MODEL ||
          "gpt-5.4-mini",
        input: [
          {
            role: "developer",
            content:
              "You are the creative director for an original, family-friendly 2D pixel-art game. Enrich the supplied idea without copying existing franchises. Keep objectives achievable by the provided game template. Asset prompts describe cohesive 32-bit pixel art with transparent sprite backgrounds where relevant.",
          },
          {
            role: "user",
            content: `Template: ${base.template}\nGame idea: ${prompt}`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "game_enrichment",
            strict: true,
            schema: enrichmentSchema,
          },
        },
        reasoning: { effort: "low" },
      }),
    });
    if (!response.ok)
      throw new Error(`OpenAI request failed: ${response.status}`);
    const enrichment = JSON.parse(
      readOutputText(await response.json()),
    ) as Enrichment;
    const spec = {
      ...base,
      title: enrichment.title,
      objective: enrichment.objective,
      theme: enrichment.theme,
      art: {
        ...base.art,
        hero: enrichment.hero,
        palette: enrichment.palette,
        manifest: {
          environment: enrichment.environment_prompt,
          hero: enrichment.hero_prompt,
          props: enrichment.prop_prompt,
        },
      },
    };
    const validation = validateGameSpec(spec);
    if (!validation.valid) throw new Error(validation.errors.join(", "));
    return Response.json({ spec, compiler: "openai" });
  } catch (error) {
    return Response.json({
      spec: base,
      compiler: "deterministic",
      warning: error instanceof Error ? error.message : "AI enrichment failed.",
    });
  }
}
