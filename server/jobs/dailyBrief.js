/**
 * Daily Brief Cron Job.
 * Runs every day at 08:00 Israel time (UTC+3 → 05:00 UTC).
 * Generates an investment analysis for every active user and saves it to agent_analyses.
 */
const cron = require('node-cron');
const { query } = require('../db/sql');
const { runInvestmentAgent } = require('../agent/investmentAgent');

const DAILY_BRIEF_CRON = process.env.DAILY_BRIEF_CRON || '0 5 * * *'; // 05:00 UTC = 08:00 Israel

async function generateDailyBrief(userId) {
  try {
    console.log(`[dailyBrief] generating for userId=${userId}`);
    const { analysis } = await runInvestmentAgent({
      userId,
      query: 'תן לי דוח בוקר קצר: מצב התיק, סיכונים בולטים, והזדמנויות להיום.',
    });

    await query(
      `INSERT INTO agent_analyses (user_id, type, analysis) VALUES (@userId, 'daily', @analysis)`,
      { userId, analysis: JSON.stringify(analysis) }
    );

    // Check for urgent alerts in analysis
    if (analysis && typeof analysis === 'object') {
      const highRisks = (analysis.risks || []).filter(r => r.severity === 'high');
      if (highRisks.length > 0) {
        console.log(`[dailyBrief] ⚠️  userId=${userId} has ${highRisks.length} high-severity risk(s):`,
          highRisks.map(r => r.type).join(', '));
        // Future: send push/email notification here
      }
    }

    console.log(`[dailyBrief] ✅ saved for userId=${userId}`);
  } catch (err) {
    console.error(`[dailyBrief] ❌ failed for userId=${userId}:`, err.message);
  }
}

async function runDailyBriefForAllUsers() {
  console.log('[dailyBrief] Starting daily brief run...');
  try {
    const result = await query(
      `SELECT id FROM users WHERE ai_data_access = 1`
    );
    const users = result.recordset;
    console.log(`[dailyBrief] Processing ${users.length} users`);

    // Process sequentially to avoid overwhelming APIs
    for (const user of users) {
      await generateDailyBrief(user.id);
      // Brief pause between users to respect API rate limits
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('[dailyBrief] Daily brief run complete');
  } catch (err) {
    console.error('[dailyBrief] Run failed:', err.message);
  }
}

function startDailyBriefJob() {
  cron.schedule(DAILY_BRIEF_CRON, runDailyBriefForAllUsers, {
    timezone: 'Asia/Jerusalem',
  });
  console.log(`⏰ Daily brief job scheduled: ${DAILY_BRIEF_CRON} (Israel time)`);
}

module.exports = { startDailyBriefJob, runDailyBriefForAllUsers };
