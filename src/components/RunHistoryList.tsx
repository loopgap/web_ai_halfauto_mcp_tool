import React from "react";
import RunItem from "./RunItem";
import type { RunRecord } from "../types";
import { useVirtualScroll } from "../hooks/useVirtualScroll";

interface RunHistoryListProps {
  runs: RunRecord[];
}

const CONTAINER_HEIGHT = 400;
const ITEM_HEIGHT = 52; // Roughly px-4 py-3 + text height

const RunHistoryList = React.memo(({ runs }: RunHistoryListProps) => {
  const { visibleRange, totalHeight, offsetTop, containerRef, onScroll } = useVirtualScroll({
    itemCount: runs.length,
    itemHeight: ITEM_HEIGHT,
    containerHeight: CONTAINER_HEIGHT,
    overscan: 5,
  });

  if (runs.length === 0) return null;

  return (
    <div className="glass-card-static p-6">
      <h3 className="text-base font-semibold mb-4">{"\u8fd0\u884c\u8bb0\u5f55"}</h3>
      <div 
        ref={containerRef} 
        onScroll={onScroll} 
        style={{ height: CONTAINER_HEIGHT, overflow: "auto" }}
        className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          <div style={{ transform: `translateY(${offsetTop}px)`, position: "absolute", left: 0, right: 0 }} className="space-y-2">
            {runs.slice(visibleRange.start, visibleRange.end).map((run) => (
              <RunItem key={run.id} run={run} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 text-[10px] text-slate-500 text-right">
        {"\u663e\u793a "} {runs.length} {" \u6761\u8bb0\u5f55 \u00b7 \u5df2\u542f\u7528\u865a\u62df\u6eda\u52a8"}
      </div>
    </div>
  );
});

export default RunHistoryList;
