/**
 * Investment Agent Orchestrator.
 * Runs an agentic loop with Claude claude-opus-4-6 using tool_use.
 */
const Anthropic = require('@anthropic-ai/sdk');
const { buildAgentSystemPrompt } = require('./systemPrompt');
const { AGENT_TOOLS } = require('./tools/index');
const { executeTool } = require('./toolExecutor');

// Full analysis: Opus for depth. Chat: Sonnet for speed.
const MODEL_ANALYSIS = 'claude-opus-4-6';
const MODEL_CHAT     = 'claude-sonnet-4-6';
const MAX_ITERATIONS_ANALYSIS = 10;
const MAX_ITERATIONS_CHAT     = 5;
const MAX_TOKENS_ANALYSIS = 4096;
const MAX_TOKENS_CHAT     = 2048;

/**
 * Run the investment agent for a user query.
 *
 * @param {object} params
 * @param {string|number} params.userId
 * @param {string} [params.query] - Optional user question; if omitted runs full portfolio analysis
 * @param {Array}  [params.conversationHistory] - Prior messages [{role, content}]
 * @returns {Promise<{analysis: object|string, recommendations: Array, portfolioHealth: object|null, conversationHistory: Array}>}
 */
async function runInvestmentAgent({ userId, query = null, conversationHistory = [] }) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
  });

  const isChat = query !== null;
  const model = isChat ? MODEL_CHAT : MODEL_ANALYSIS;
  const maxIterations = isChat ? MAX_ITERATIONS_CHAT : MAX_ITERATIONS_ANALYSIS;
  const maxTokens = isChat ? MAX_TOKENS_CHAT : MAX_TOKENS_ANALYSIS;

  const systemPrompt = buildAgentSystemPrompt();

  const userMessage = query
    ? query
    : 'נתח את התיק המלא שלי. תן לי תמונה הוליסטית, זהה סיכונים, והמלץ על פעולות.';

  const messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  let iterations = 0;
  let finalText = null;
  let currentMessages = [...messages];

  while (iterations < maxIterations) {
    iterations++;

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: AGENT_TOOLS,
      messages: currentMessages,
    });

    // Append assistant response to message history
    currentMessages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      // Extract text from last assistant message
      const textBlock = response.content.find(b => b.type === 'text');
      finalText = textBlock?.text || null;
      break;
    }

    if (response.stop_reason === 'tool_use') {
      // Execute all tool calls in parallel
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (toolBlock) => {
          console.log(`[agent] calling tool: ${toolBlock.name}`, toolBlock.input);
          const result = await executeTool(toolBlock.name, toolBlock.input, userId);
          return {
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify(result),
          };
        })
      );

      // Add tool results as user message
      currentMessages.push({ role: 'user', content: toolResults });
      continue;
    }

    // Unexpected stop reason — break to avoid infinite loop
    console.warn(`[agent] unexpected stop_reason: ${response.stop_reason}`);
    break;
  }

  if (!finalText) {
    throw new Error('Agent did not produce a final response after tool calls');
  }

  // Parse JSON from the response if present
  let analysis = finalText;
  let recommendations = [];
  let portfolioHealth = null;

  try {
    // Try to extract JSON block from markdown code fences or raw JSON
    const jsonMatch = finalText.match(/```(?:json)?\s*([\s\S]*?)```/) || finalText.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      analysis = parsed;
      recommendations = parsed.recommendations || [];
      portfolioHealth = parsed.portfolio_health || null;
    }
  } catch {
    // Response is plain text — return as-is
  }

  // Build updated conversation history (trim to last 20 messages to avoid bloat)
  const updatedHistory = currentMessages.slice(-20);

  return { analysis, recommendations, portfolioHealth, conversationHistory: updatedHistory };
}

module.exports = { runInvestmentAgent };
