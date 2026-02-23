import React, { useState } from "react";
import { X } from "lucide-react";

interface MemoFormProps {
  onClose: () => void;
}

export default function MemoForm({ onClose }: MemoFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });

      if (res.ok) {
        window.dispatchEvent(new Event("memo-added"));
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2A2420]/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-[#F0EBE1]">
          <h2 className="text-lg font-bold text-[#5C4D43]">메모 남기기</h2>
          <button
            onClick={onClose}
            className="p-2 text-[#8A7E73] hover:text-[#5C4D43] hover:bg-[#FDFBF7] rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-[#8A7E73] mb-1"
            >
              제목
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              className="w-full px-4 py-2 border border-[#E8E3D9] rounded-xl focus:ring-2 focus:ring-[#D4A373] focus:border-[#D4A373] outline-none transition-all"
              required
            />
          </div>

          <div>
            <label
              htmlFor="body"
              className="block text-sm font-medium text-[#8A7E73] mb-1"
            >
              내용
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="따뜻한 한마디를 남겨주세요..."
              rows={5}
              className="w-full px-4 py-2 border border-[#E8E3D9] rounded-xl focus:ring-2 focus:ring-[#D4A373] focus:border-[#D4A373] outline-none transition-all resize-none"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !body.trim()}
              className="w-full bg-[#D4A373] hover:bg-[#C29262] disabled:bg-[#E8E3D9] disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
            >
              {isSubmitting ? "저장 중..." : "메모 저장하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
