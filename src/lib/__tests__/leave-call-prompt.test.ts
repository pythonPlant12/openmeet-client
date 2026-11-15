import { afterEach, describe, expect, it } from 'vitest';

import { answerLeaveCallPrompt, askToLeaveActiveCall, leaveCallPrompt } from '@/lib/leave-call-prompt';

describe('leave call prompt', () => {
  afterEach(() => {
    if (leaveCallPrompt.value) answerLeaveCallPrompt(false);
  });

  it('asks once, and resolves with the answer', async () => {
    const asked = askToLeaveActiveCall();
    expect(leaveCallPrompt.value).not.toBeNull();

    answerLeaveCallPrompt(true);
    await expect(asked).resolves.toBe(true);
    expect(leaveCallPrompt.value).toBeNull();

    const declined = askToLeaveActiveCall();
    answerLeaveCallPrompt(false);
    await expect(declined).resolves.toBe(false);
    expect(leaveCallPrompt.value).toBeNull();
  });

  it('refuses a second question while one is open', async () => {
    const first = askToLeaveActiveCall();
    await expect(askToLeaveActiveCall()).resolves.toBe(false);
    expect(leaveCallPrompt.value).not.toBeNull();
    answerLeaveCallPrompt(true);
    await expect(first).resolves.toBe(true);
  });
});
