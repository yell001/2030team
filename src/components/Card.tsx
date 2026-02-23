import React, { useState, useEffect } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { ContentItem } from "./Feed";
import CommentModal from "./CommentModal";

interface CardProps {
  item: ContentItem;
  userId: string;
}

export default function Card({ item, userId }: CardProps) {
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);

  // ✅ 이미지 확대 모달 상태
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  useEffect(() => {
    // Fetch initial likes
    const fetchLikes = async () => {
      try {
        const res = await fetch("/api/likes");
        if (res.ok) {
          const data = await res.json();
          const itemLikes = data.find((l: any) => l.content_id == item.id);
          if (itemLikes) {
            setLikes(itemLikes.count);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    // Fetch comments count
    const fetchCommentsCount = async () => {
      try {
        const res = await fetch(`/api/comments/${item.id}`);
        if (res.ok) {
          const data = await res.json();
          setCommentsCount(data.length);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchLikes();
    fetchCommentsCount();

    // Check local storage for like status
    const likedItems = JSON.parse(localStorage.getItem("likedItems") || "{}");
    if (likedItems[item.id]) {
      setIsLiked(true);
    }
  }, [item.id]);

  // ✅ ESC로 확대 모달 닫기
  useEffect(() => {
    if (!isZoomOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsZoomOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    // 스크롤 잠금(선택이지만 UX 좋아짐)
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isZoomOpen]);

  const handleLike = async () => {
    // Optimistic update
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikes((prev) => (newLiked ? prev + 1 : Math.max(0, prev - 1)));

    // Update local storage
    const likedItems = JSON.parse(localStorage.getItem("likedItems") || "{}");
    if (newLiked) {
      likedItems[item.id] = true;
    } else {
      delete likedItems[item.id];
    }
    localStorage.setItem("likedItems", JSON.stringify(likedItems));

    // Send request to server
    try {
      const res = await fetch(`/api/likes/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        // Rollback if failed
        setIsLiked(!newLiked);
        setLikes((prev) => (newLiked ? Math.max(0, prev - 1) : prev + 1));
      }
    } catch (err) {
      console.error(err);
      // Rollback if failed
      setIsLiked(!newLiked);
      setLikes((prev) => (newLiked ? Math.max(0, prev - 1) : prev + 1));
    }
  };

  const renderContent = () => {
    switch (item.type) {
      case "media":
        if (item.mimeType?.startsWith("video/")) {
          return (
            <div className="relative w-full overflow-hidden rounded-t-2xl bg-[#2A2420]">
              <video
                controls
                className="w-full h-auto max-h-[600px] object-contain"
                preload="metadata"
                poster={item.thumbnailUrl}
              >
                <source src={item.webContentLink} type={item.mimeType} />
                Your browser does not support the video tag.
              </video>
            </div>
          );
        }

        // ✅ 리스트에서는 썸네일(빠름)
        const thumbUrl = item.thumbnailUrl
          ? item.thumbnailUrl.replace(/=s\d+/, "=s1000")
          : "";

        /**
         * ✅ 확대(고화질)에서는 원본 우선
         * 1) webContentLink가 있으면 우선 사용 (대체로 원본/큰 파일 접근)
         * 2) 혹시 webContentLink가 없거나 제한되면 drive uc 링크로 fallback
         * 3) 그래도 안 되면 thumbnail을 아주 크게(=s4000) 시도
         */
        const driveViewUrl = item.id
          ? `https://drive.google.com/uc?export=view&id=${item.id}`
          : "";

        const fallbackBigThumb = item.thumbnailUrl
          ? item.thumbnailUrl.replace(/=s\d+/, "=s4000")
          : "";

        const fullUrl =
          item.webContentLink || driveViewUrl || fallbackBigThumb || thumbUrl;

        return (
          <>
            <div className="relative w-full overflow-hidden rounded-t-2xl bg-[#F0EBE1]">
              <img
                src={thumbUrl || fullUrl}
                alt={item.name || "추억 사진"}
                loading="lazy"
                className="w-full h-auto object-cover cursor-zoom-in"
                onClick={() => setIsZoomOpen(true)}
              />
            </div>

            {/* ✅ 같은 창에서 크게 보기: 확대 모달 */}
            {isZoomOpen && (
              <div
                onClick={() => setIsZoomOpen(false)}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                style={{
                  background: "rgba(0,0,0,0.75)",
                  cursor: "zoom-out",
                }}
              >
                <img
                  src={fullUrl}
                  alt={item.name || "확대 이미지"}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: "95vw",
                    maxHeight: "95vh",
                    objectFit: "contain",
                    borderRadius: 12,
                    background: "white",
                  }}
                />
              </div>
            )}
          </>
        );

      case "memo":
        return (
          <div className="p-6 bg-[#FAEDCD] rounded-t-2xl border-b border-[#E8E3D9]">
            <h3 className="text-lg font-bold text-[#5C4D43] mb-2">
              {item.title}
            </h3>
            <p className="text-[#8A7E73] whitespace-pre-wrap leading-relaxed">
              {item.body}
            </p>
          </div>
        );

      case "quote":
        return (
          <div className="p-8 bg-[#5C4D43] rounded-t-2xl text-[#FDFBF7] flex flex-col items-center justify-center text-center min-h-[200px]">
            <p className="text-xl font-semibold italic leading-relaxed mb-4">
              “{item.text}”
            </p>
            <span className="text-sm opacity-80">— {item.personName}</span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-[#FDFBF7] rounded-2xl shadow-sm border border-[#E8E3D9] overflow-hidden">
      {renderContent()}

      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className="flex items-center gap-2 text-[#8A7E73] hover:text-[#5C4D43] transition"
            aria-label="like"
          >
            <Heart
              size={20}
              className={isLiked ? "fill-[#E76F51] text-[#E76F51]" : ""}
            />
            <span className="text-sm">{likes}</span>
          </button>

          <button
            onClick={() => setIsCommentModalOpen(true)}
            className="flex items-center gap-2 text-[#8A7E73] hover:text-[#5C4D43] transition"
            aria-label="comment"
          >
            <MessageCircle size={20} />
            <span className="text-sm">{commentsCount}</span>
          </button>
        </div>
      </div>

      {/* 댓글 모달 */}
      <CommentModal
        isOpen={isCommentModalOpen}
        onClose={() => setIsCommentModalOpen(false)}
        contentId={item.id}
      />
    </div>
  );
}