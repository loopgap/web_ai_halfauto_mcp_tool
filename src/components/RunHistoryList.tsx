import React from "react";
import RunItem from "./RunItem";
import type { RunRecord } from "../types";

interface RunHistoryListProps {
  runs: RunRecord[];
}

const RunHistoryList = React.memo(({ runs }: RunHistoryListProps) => {
  if (runs.length === 0) return null;

  return (
    <div className="glass-card-static p-6">
      <h3 className="text-base font-semibold mb-4">{"\u8fd0\u884c\u8bb0\u5f55"}</h3>
      <div className="space-y-2">
        {runs.map((run) => (
          <RunItem key={run.id} run={run} />
        ))}
      </div>
    </div>
  );
});

export default RunHistoryList;
