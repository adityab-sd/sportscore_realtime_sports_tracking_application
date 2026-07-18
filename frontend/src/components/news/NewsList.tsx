"use client";
import { useState } from "react";
import { NewsItem } from "@/lib/api/espn";
import NewsCard from "./NewsCard";

export default function NewsList({ articles, initial = 6, step = 3 }: { articles: NewsItem[]; initial?: number; step?: number }) {
  const [visible, setVisible] = useState(initial);
  const shown = articles.slice(0, visible);
  const hasMore = visible < articles.length;
  // ============================================================================
  // PLEASE review — add an empty state
  // ----------------------------------------------------------------------------
  // When articles is empty the component renders a blank region, which looks like
  // a loading failure and gives screen-reader users no status. Return a small
  // message before the grid when there are no stories.
  //
  // EXAMPLE:
  //   if (articles.length === 0) return <p>No stories available right now.</p>;
  // ============================================================================
  return (
    <div>
      <div className="news-grid">{shown.map(a => <NewsCard key={a.id} article={a} />)}</div>
      {hasMore && (
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <button onClick={() => setVisible(v => v + step)} style={{ background: "var(--white)", border: "1.5px solid var(--navy)", color: "var(--navy)", fontWeight: 700, fontSize: 14, padding: "12px 28px", borderRadius: 10, cursor: "pointer" }}>
            Load more stories
          </button>
        </div>
      )}
    </div>
  );
}
