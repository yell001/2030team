/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Feed from "./components/Feed";
import MemoForm from "./components/MemoForm";
import {
  Heart,
  MessageCircle,
  Plus,
  Image as ImageIcon,
  MessageSquareQuote,
  StickyNote,
  LayoutGrid,
  Menu,
  X,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export type FilterType = "all" | "media" | "memo" | "quote";

export default function App() {
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    let id = localStorage.getItem("userId");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("userId", id);
    }
    setUserId(id);

    // Auto-collapse sidebar on smaller screens
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filters = [
    { id: "all", label: "모두 보기", icon: LayoutGrid },
    { id: "media", label: "사진/영상", icon: ImageIcon },
    { id: "memo", label: "메모", icon: StickyNote },
    { id: "quote", label: "한마디", icon: MessageSquareQuote },
  ] as const;

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-800 font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-[#E8E3D9]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-[#8A7E73] hover:text-[#5C4D43] hover:bg-[#F0EBE1] rounded-full transition-colors"
              aria-label="Toggle menu"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-[#5C4D43] font-serif">
              우리의 추억
            </h1>
          </div>
          <button
            onClick={() => setIsMemoModalOpen(true)}
            className="flex items-center gap-2 bg-[#D4A373] hover:bg-[#C29262] text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">메모 남기기</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex relative overflow-hidden">
        {/* Sidebar Navigation */}
        <aside
          className={`absolute md:relative z-10 h-full bg-[#FDFBF7] transition-all duration-300 ease-in-out overflow-hidden ${
            isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0"
          }`}
        >
          <div className="w-64 p-4 h-full overflow-y-auto">
            <div className="sticky top-4 flex flex-col gap-2 bg-white p-4 rounded-2xl shadow-sm border border-[#F0EBE1]">
              <div className="flex items-center justify-between mb-2 px-3">
                <h2 className="text-sm font-bold text-[#8A7E73] uppercase tracking-wider">
                  필터
                </h2>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="md:hidden p-1 text-[#8A7E73] hover:text-[#5C4D43] rounded-full"
                >
                  <X size={16} />
                </button>
              </div>
              {filters.map((filter) => {
                const Icon = filter.icon;
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => {
                      setActiveFilter(filter.id as FilterType);
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      isActive
                        ? "bg-[#FAEDCD] text-[#5C4D43] font-bold shadow-sm"
                        : "text-[#8A7E73] hover:bg-[#FDFBF7] hover:text-[#5C4D43]"
                    }`}
                  >
                    <Icon
                      size={20}
                      className={isActive ? "text-[#D4A373]" : ""}
                    />
                    <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-stone-900/20 z-0 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Feed Area */}
        <main className="flex-1 min-w-0 p-4 overflow-y-auto h-[calc(100vh-73px)]">
          <Feed userId={userId} filter={activeFilter} />
        </main>
      </div>

      {/* Memo Modal */}
      {isMemoModalOpen && (
        <MemoForm onClose={() => setIsMemoModalOpen(false)} />
      )}
    </div>
  );
}
