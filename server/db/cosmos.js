// server/db/cosmos.js
const { CosmosClient } = require('@azure/cosmos');

let client;
let container;

async function connectCosmos() {
  client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);

  const { database } = await client.databases.createIfNotExists({
    id: process.env.COSMOS_DATABASE || 'plentyrise'
  });

  const { container: c } = await database.containers.createIfNotExists({
    id: process.env.COSMOS_CONTAINER || 'ai_conversations',
    partitionKey: { paths: ['/userId'] }
  });

  container = c;
  return container;
}

function getContainer() {
  if (!container) throw new Error('Cosmos not initialized. Call connectCosmos() first.');
  return container;
}

// Save a conversation message
async function saveMessage(userId, sessionId, role, content) {
  const c = getContainer();
  return c.items.create({
    id: `${sessionId}_${Date.now()}`,
    userId,
    sessionId,
    role,       // 'user' | 'assistant'
    content,
    timestamp: new Date().toISOString()
  });
}

// Get conversation history for a session
async function getHistory(userId, sessionId, limit = 20) {
  const c = getContainer();
  const { resources } = await c.items.query({
    query: `
      SELECT TOP @limit * FROM c
      WHERE c.userId = @userId AND c.sessionId = @sessionId
      ORDER BY c.timestamp ASC
    `,
    parameters: [
      { name: '@userId', value: userId },
      { name: '@sessionId', value: sessionId },
      { name: '@limit', value: limit }
    ]
  }, { partitionKey: userId }).fetchAll();

  return resources;
}

// List all sessions for a user
async function getUserSessions(userId) {
  const c = getContainer();
  const { resources } = await c.items.query({
    query: `
      SELECT DISTINCT c.sessionId, MIN(c.timestamp) AS started_at
      FROM c WHERE c.userId = @userId
      GROUP BY c.sessionId
      ORDER BY started_at DESC
    `,
    parameters: [{ name: '@userId', value: userId }]
  }, { partitionKey: userId }).fetchAll();

  return resources;
}

module.exports = { connectCosmos, getContainer, saveMessage, getHistory, getUserSessions };
