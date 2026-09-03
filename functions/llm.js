// Provider router.
//
// One place decides which model answers which job, so a route can be moved
// between providers by editing a table rather than a call site. Two providers
// are wired up because neither covers everything: Anthropic has no embeddings
// endpoint, so vectors stay on OpenAI regardless of where chat goes.
const OpenAIModule = require("openai");
const AnthropicModule = require("@anthropic-ai/sdk");

const OpenAI = OpenAIModule.default || OpenAIModule;
const Anthropic = AnthropicModule.default || AnthropicModule;

// Which model handles which job. `effort` controls how much reasoning Claude
// spends; it replaces the temperature knob, which current Claude models reject.
const ROUTES = {
  synapseAnalysis: { provider: "anthropic", model: "claude-opus-5", effort: "high", maxTokens: 8000 },
  synapseBroader: { provider: "anthropic", model: "claude-opus-5", effort: "medium", maxTokens: 4000 },
  synapseLearningPlan: { provider: "anthropic", model: "claude-opus-5", effort: "high", maxTokens: 16000 },
  analyzeContent: { provider: "anthropic", model: "claude-opus-5", effort: "medium", maxTokens: 4000 },
  suggestions: { provider: "anthropic", model: "claude-opus-5", effort: "low", maxTokens: 600 },
};

let openaiClient = null;
let anthropicClient = null;

function getOpenAI(apiKey) {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

function getAnthropic(apiKey, workspaceId) {
  if (!anthropicClient) {
    // An identity-linked API key must name the workspace it acts in, or every
    // request fails with a 400. A key created directly inside a workspace does
    // not need this, so the header is only sent when configured.
    anthropicClient = new Anthropic({
      apiKey,
      ...(workspaceId
        ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } }
        : {}),
    });
  }
  return anthropicClient;
}

async function callAnthropic({ route, system, prompt, keys, cacheSystem }) {
  // The stable part of the prompt goes in `system` so it can be cached: a
  // synapse is asked several questions in a row, and analyzeSynapseContent
  // alone makes up to three calls over the same context.
  const systemBlocks = [{ type: "text", text: system }];
  if (cacheSystem) {
    systemBlocks.push({
      type: "text",
      text: cacheSystem,
      cache_control: { type: "ephemeral" },
    });
  }

  const response = await getAnthropic(keys.anthropic, keys.anthropicWorkspaceId).messages.create({
    model: route.model,
    max_tokens: route.maxTokens,
    system: systemBlocks,
    thinking: { type: "adaptive" },
    output_config: { effort: route.effort },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.usage) {
    console.log(
      `${route.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens} ` +
        `cache_read=${response.usage.cache_read_input_tokens || 0}`
    );
  }

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

async function callOpenAI({ route, system, prompt, keys, cacheSystem }) {
  const response = await getOpenAI(keys.openai).chat.completions.create({
    model: route.model,
    max_tokens: route.maxTokens,
    messages: [
      { role: "system", content: cacheSystem ? `${system}\n\n${cacheSystem}` : system },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message.content.trim();
}

/**
 * Run one routed completion.
 *
 * @param {string} routeName   key into ROUTES
 * @param {object} opts
 * @param {string} opts.system       instructions; stable across calls
 * @param {string} opts.prompt       the request itself
 * @param {string} [opts.cacheSystem] large stable context, cached where supported
 * @param {object} opts.keys         { anthropic, anthropicWorkspaceId, openai }
 * @param {string} [opts.effort]     override the route's effort
 */
async function complete(routeName, opts) {
  const base = ROUTES[routeName];
  if (!base) throw new Error(`Unknown LLM route: ${routeName}`);

  const route = opts.effort ? { ...base, effort: opts.effort } : base;
  const args = { ...opts, route };

  return route.provider === "anthropic"
    ? callAnthropic(args)
    : callOpenAI(args);
}

// Embeddings are OpenAI-only: Anthropic does not offer an embeddings endpoint.
// Changing this model means re-embedding everything and rebuilding the vector
// indexes at the new dimension.
const EMBEDDING_MODEL = "text-embedding-ada-002";

async function createEmbedding(text, apiKey) {
  const response = await getOpenAI(apiKey).embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

module.exports = { complete, createEmbedding, EMBEDDING_MODEL, ROUTES };
