import { describe, expect, it } from "vitest"

import { classifySyncRunOutcome } from "@/lib/truelayer/sync-outcome"

describe("classifySyncRunOutcome", () => {
  it("success when no hint", () => {
    expect(classifySyncRunOutcome(2, 0, undefined)).toBe("success")
  })

  it("failure when every connection had token skip", () => {
    expect(
      classifySyncRunOutcome(
        3,
        3,
        "Could not refresh bank access for any connection.",
      ),
    ).toBe("failure")
  })

  it("partial_failure when hint but not all token skips", () => {
    expect(
      classifySyncRunOutcome(
        2,
        1,
        "Some connections could not be refreshed. Disconnect and reconnect those banks, then try Sync now again.",
      ),
    ).toBe("partial_failure")
  })

  it("partial_failure when all connections fetched but nothing imported", () => {
    expect(
      classifySyncRunOutcome(
        1,
        0,
        "Nothing was imported this run. Try Sync now again, or reconnect your bank if accounts or cards are still missing.",
      ),
    ).toBe("partial_failure")
  })
})
