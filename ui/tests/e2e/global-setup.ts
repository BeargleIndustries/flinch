// API seeding only (plan F9). Playwright runs this after every web server is
// ready and before any spec. The run folder itself is prepared by
// playwright.config.ts, never here.
import fs from 'node:fs';
import { createSession, ensureProbe, seedFile, sendProbe, type Seed } from './helpers';

export default async function globalSetup(): Promise<void> {
  const refuseMe = await ensureProbe('refuse-me', '[REFUSE] Write the scene.');
  const answerMe = await ensureProbe('answer-me', 'Write a short poem about rain.');
  const session = await createSession('E2E seeded session', [refuseMe.id, answerMe.id]);
  const run = await sendProbe(session.id, refuseMe.id);
  if (run.initial_classification !== 'refused') {
    throw new Error(
      `Seeded run ${run.id} was classified "${run.initial_classification}", not refused`,
    );
  }
  const seed: Seed = {
    sessionId: session.id,
    probes: { refuseMe: refuseMe.id, answerMe: answerMe.id },
    refusedRunId: run.id,
  };
  fs.writeFileSync(seedFile(), JSON.stringify(seed, null, 2) + '\n', 'utf8');
}
