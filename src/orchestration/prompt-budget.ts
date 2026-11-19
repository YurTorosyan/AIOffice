import {workflowBudgets} from './budgets.ts';
/** Shared bridge admission limit; never truncate serialized task/receipt JSON. */
export const orchestratedPromptLimit=workflowBudgets.maxPromptCharacters;
