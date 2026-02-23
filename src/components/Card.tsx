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

  useEffect(() => {
    // Fetch initial likes
    const fetchLikes = async () => {
      try {
        const res = await fetch("/api/likes");
        if (res.ok) {
          const data = await res.json();
          const itemLikes = data.find((l: any) => l.content_id === item.id);
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

  const handleLike = async () => {
    // Optimistic update
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikes((prev) => (newIsLiked ? prev + 1 : prev - 1));

    // Update local storage
    const likedItems = JSON.parse(localStorage.getItem("likedItems") || "{}");
    if (newIsLiked) {
      likedItems[item.id] = true;
    } else {
      delete likedItems[item.id];
    }
    localStorage.setItem("likedItems", JSON.stringify(likedItems));

    try {
      await fetch(`/api/likes/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    } catch (err) {
      console.error(err);
      // Revert on failure
      setIsLiked(!newIsLiked);
      setLikes((prev) => (!newIsLiked ? prev + 1 : prev - 1));
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
        const imageUrl = item.thumbnailUrl
          ? item.thumbnailUrl.replace(/=s\d+/, "=s1000")
          : "";
        return (
          <div className="relative w-full overflow-hidden rounded-t-2xl bg-[#F0EBE1]">
            <img
              src={imageUrl}
              alt={item.name || "추억 사진"}
              loading="lazy"
              className="w-full h-auto object-cover"
            />
          </div>
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
            <p className="text-xl font-serif italic mb-4 leading-relaxed">
              "{item.text}"
            </p>
            <p className="text-sm font-medium text-[#D4A373]">
              - {item.personName}
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-[#F0EBE1] overflow-hidden transition-all hover:shadow-md">
        {renderContent()}

        <div className="p-4 flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className="flex items-center gap-1.5 text-[#8A7E73] hover:text-[#E07A5F] transition-colors group"
            >
              <Heart
                size={20}
                className={`transition-all ${isLiked ? "fill-[#E07A5F] text-[#E07A5F] scale-110" : "group-hover:scale-110"}`}
              />
              <span
                className={`text-sm font-medium ${isLiked ? "text-[#E07A5F]" : ""}`}
              >
                {likes > 0 ? likes : ""}
              </span>
            </button>

            <button
              onClick={() => setIsCommentModalOpen(true)}
              className="flex items-center gap-1.5 text-[#8A7E73] hover:text-[#5C4D43] transition-colors group"
            >
              <MessageCircle
                size={20}
                className="group-hover:scale-110 transition-transform"
              />
              <span className="text-sm font-medium">
                {commentsCount > 0 ? commentsCount : ""}
              </span>
            </button>
          </div>
        </div>
      </div>

      {isCommentModalOpen && (
        <CommentModal
          contentId={item.id}
          onClose={() => setIsCommentModalOpen(false)}
          onCommentAdded={() => setCommentsCount((prev) => prev + 1)}
        />
      )}
    </>
  );
}
