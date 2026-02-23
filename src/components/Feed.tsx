import React, { useState, useEffect } from "react";
import Card from "./Card";
import { Loader2 } from "lucide-react";
import { FilterType } from "../App";

interface FeedProps {
  userId: string;
  filter: FilterType;
}

export type ContentItem = {
  id: string;
  type: "media" | "memo" | "quote";
  createdAt: string;
  // Media specific
  mimeType?: string;
  thumbnailUrl?: string;
  webContentLink?: string;
  name?: string;
  // Memo specific
  title?: string;
  body?: string;
  // Quote specific
  personName?: string;
  text?: string;
};

export default function Feed({ userId, filter }: FeedProps) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      setError(null);

      const [driveRes, memosRes, quotesRes] = await Promise.all([
        fetch("/api/drive").catch(() => ({ ok: false, json: () => [] })),
        fetch("/api/memos").catch(() => ({ ok: false, json: () => [] })),
        fetch("/api/quotes").catch(() => ({ ok: false, json: () => [] })),
      ]);

      let driveFiles = [];
      if (driveRes.ok) {
        driveFiles = await driveRes.json();
      } else {
        console.warn("Failed to fetch drive files. Check API key.");
      }

      let memos = [];
      if (memosRes.ok) memos = await memosRes.json();

      let quotes = [];
      if (quotesRes.ok) quotes = await quotesRes.json();

      const formattedDriveFiles: ContentItem[] = driveFiles.map((f: any) => ({
        id: f.id,
        type: "media",
        createdAt: f.createdTime,
        mimeType: f.mimeType,
        thumbnailUrl: f.thumbnailLink,
        webContentLink: f.webContentLink,
        name: f.name,
      }));

      const formattedMemos: ContentItem[] = memos.map((m: any) => ({
        id: m.id,
        type: "memo",
        createdAt: m.created_at,
        title: m.title,
        body: m.body,
      }));

      const formattedQuotes: ContentItem[] = quotes.map((q: any) => ({
        id: q.id,
        type: "quote",
        createdAt: q.created_at,
        personName: q.person_name,
        text: q.text,
      }));

      const allItems = [
        ...formattedDriveFiles,
        ...formattedMemos,
        ...formattedQuotes,
      ];

      // Sort by random or created_at. Let's do random for a mixed feed feel.
      allItems.sort(() => Math.random() - 0.5);

      setItems(allItems);
    } catch (err) {
      console.error(err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();

    // Listen for new memos
    const handleNewMemo = () => {
      fetchFeed();
    };
    window.addEventListener("memo-added", handleNewMemo);
    return () => window.removeEventListener("memo-added", handleNewMemo);
  }, []);

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    return item.type === filter;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#8A7E73]">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#D4A373]" />
        <p>추억을 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-rose-500">
        <p>{error}</p>
        <button onClick={fetchFeed} className="mt-4 underline text-[#D4A373]">
          다시 시도
        </button>
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="text-center py-20 text-[#8A7E73]">
        <p>아직 등록된 추억이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-6">
      {filteredItems.map((item) => (
        <div key={item.id} className="break-inside-avoid mb-6">
          <Card item={item} userId={userId} />
        </div>
      ))}
    </div>
  );
}
