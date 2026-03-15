import client from '../api/client';

/** Run a full portfolio analysis (no user query). */
export async function analyzePortfolio() {
  const { data } = await client.post('/agent/analyze');
  return data;
}

/**
 * Send a chat message to the investment agent.
 * @param {string} query
 * @param {Array}  conversationHistory
 */
export async function chatWithAgent(query, conversationHistory = []) {
  const { data } = await client.post('/agent/chat', { query, conversationHistory });
  return data;
}

/** Get the latest saved daily brief for the current user. */
export async function getDailyBrief() {
  const { data } = await client.get('/agent/daily-brief');
  return data;
}

/** Get analysis history. */
export async function getAgentHistory(limit = 10) {
  const { data } = await client.get(`/agent/history?limit=${limit}`);
  return data;
}

/** Get the last saved full portfolio analysis. */
export async function getLastAnalysis() {
  const { data } = await client.get('/agent/last-analysis');
  return data;
}
