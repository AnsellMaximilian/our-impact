export type AllocationModel =
  | "winner_takes_all"
  | "proportional"
  | "hybrid";

export type AllocationInput = {
  organizationId: number;
  votes: number;
};

export type AllocationLine = AllocationInput & {
  amountMinor: number;
};

export type AllocationPreview = {
  lines: AllocationLine[];
  allocatedMinor: number;
  unallocatedMinor: number;
  requiresReview: boolean;
  reason?: "no_votes";
};

function validateInputs(budgetMinor: number, inputs: AllocationInput[]) {
  if (!Number.isSafeInteger(budgetMinor) || budgetMinor <= 0) {
    throw new Error("Budget must be a positive integer in minor currency units.");
  }

  if (inputs.length < 2 || inputs.length > 5) {
    throw new Error("Allocation previews require between 2 and 5 organizations.");
  }

  const ids = new Set<number>();
  for (const input of inputs) {
    if (!Number.isSafeInteger(input.organizationId) || input.organizationId <= 0) {
      throw new Error("Organization IDs must be positive integers.");
    }
    if (!Number.isSafeInteger(input.votes) || input.votes < 0) {
      throw new Error("Vote counts must be non-negative integers.");
    }
    if (ids.has(input.organizationId)) {
      throw new Error("Organizations must be unique.");
    }
    ids.add(input.organizationId);
  }
}

function splitDeterministically(
  amountMinor: number,
  inputs: AllocationInput[],
): Map<number, number> {
  const result = new Map(inputs.map((input) => [input.organizationId, 0]));
  if (amountMinor === 0 || inputs.length === 0) return result;

  const amount = BigInt(amountMinor);
  const totalVotes = inputs.reduce((sum, input) => sum + BigInt(input.votes), 0n);

  if (totalVotes === 0n) return result;

  const rankedRemainders: Array<{
    organizationId: number;
    remainder: bigint;
  }> = [];
  let allocated = 0;

  for (const input of inputs) {
    const numerator = amount * BigInt(input.votes);
    const floorAmount = Number(numerator / totalVotes);
    allocated += floorAmount;
    result.set(input.organizationId, floorAmount);
    rankedRemainders.push({
      organizationId: input.organizationId,
      remainder: numerator % totalVotes,
    });
  }

  rankedRemainders.sort(
    (left, right) =>
      Number(right.remainder - left.remainder) ||
      left.organizationId - right.organizationId,
  );

  for (let index = 0; index < amountMinor - allocated; index += 1) {
    const winner = rankedRemainders[index % rankedRemainders.length];
    result.set(winner.organizationId, (result.get(winner.organizationId) ?? 0) + 1);
  }

  return result;
}

export function previewAllocation(
  model: AllocationModel,
  budgetMinor: number,
  inputs: AllocationInput[],
): AllocationPreview {
  validateInputs(budgetMinor, inputs);

  const totalVotes = inputs.reduce((sum, input) => sum + input.votes, 0);
  if (totalVotes === 0) {
    return {
      lines: inputs.map((input) => ({ ...input, amountMinor: 0 })),
      allocatedMinor: 0,
      unallocatedMinor: budgetMinor,
      requiresReview: true,
      reason: "no_votes",
    };
  }

  let amounts: Map<number, number>;

  if (model === "winner_takes_all") {
    const highestVoteCount = Math.max(...inputs.map((input) => input.votes));
    const winners = inputs
      .filter((input) => input.votes === highestVoteCount)
      .map((input) => ({ ...input, votes: 1 }));
    amounts = splitDeterministically(budgetMinor, winners);
  } else if (model === "proportional") {
    amounts = splitDeterministically(budgetMinor, inputs);
  } else {
    const basePerOrganization = Math.floor(budgetMinor / 10);
    const baseTotal = basePerOrganization * inputs.length;
    const proportional = splitDeterministically(budgetMinor - baseTotal, inputs);
    amounts = new Map(
      inputs.map((input) => [
        input.organizationId,
        basePerOrganization + (proportional.get(input.organizationId) ?? 0),
      ]),
    );
  }

  const lines = inputs.map((input) => ({
    ...input,
    amountMinor: amounts.get(input.organizationId) ?? 0,
  }));
  const allocatedMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);

  return {
    lines,
    allocatedMinor,
    unallocatedMinor: budgetMinor - allocatedMinor,
    requiresReview: false,
  };
}
