import React, { useState, useEffect, useRef } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface Comment {
  id: string;
  nickname: string;
  text: string;
  created_at: string;
}

interface CommentModalProps {
  contentId: string;
  onClose: () => void;
  onCommentAdded: () => void;
}

export default function CommentModal({
  contentId,
  onClose,
  onCommentAdded,
}: CommentModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/comments/${contentId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  useEffect(() => {
    // Load saved nickname
    const savedNickname = localStorage.getItem("nickname");
    if (savedNickname) setNickname(savedNickname);

    fetchComments();
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !text.trim()) return;

    localStorage.setItem("nickname", nickname);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/comments/${contentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, text }),
      });

      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setText("");
        onCommentAdded();
        scrollToBottom();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#2A2420]/40 backdrop-blur-sm sm:p-4">
      <div className="bg-white w-full sm:max-w-md h-[80vh] sm:h-[600px] sm:rounded-2xl shadow-xl flex flex-col animate-in slide-in-from-bottom sm:zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#F0EBE1] shrink-0">
          <h2 className="text-lg font-bold text-[#5C4D43]">
            댓글{" "}
            {comments.length > 0 && (
              <span className="text-[#D4A373] ml-1">{comments.length}</span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[#8A7E73] hover:text-[#5C4D43] hover:bg-[#FDFBF7] rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FDFBF7]">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#D4A373]" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10 text-[#8A7E73]">
              첫 번째 댓글을 남겨보세요!
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-[#F0EBE1] max-w-[90%]"
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-bold text-sm text-[#5C4D43]">
                    {comment.nickname}
                  </span>
                  <span className="text-xs text-[#8A7E73]">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </span>
                </div>
                <p className="text-[#5C4D43] text-sm whitespace-pre-wrap break-words">
                  {comment.text}
                </p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-[#F0EBE1] bg-white shrink-0">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임"
              className="w-1/3 min-w-[100px] px-3 py-1.5 text-sm border border-[#E8E3D9] rounded-lg focus:ring-2 focus:ring-[#D4A373] focus:border-[#D4A373] outline-none transition-all"
              required
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="댓글을 입력하세요..."
                className="flex-1 px-4 py-2 text-sm border border-[#E8E3D9] rounded-full focus:ring-2 focus:ring-[#D4A373] focus:border-[#D4A373] outline-none transition-all"
                required
              />
              <button
                type="submit"
                disabled={isSubmitting || !nickname.trim() || !text.trim()}
                className="bg-[#D4A373] hover:bg-[#C29262] disabled:bg-[#E8E3D9] text-white p-2 rounded-full transition-colors flex items-center justify-center shrink-0"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send size={18} className="ml-0.5" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
