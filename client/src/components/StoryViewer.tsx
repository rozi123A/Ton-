import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, MessageCircle, Eye, Send, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";

interface Story {
  id: number;
  userId: number;
  mediaUrl: string;
  mediaType: string;
  caption?: string | null;
  userName?: string | null;
  userAvatar?: string | null;
  viewCount?: number;
  commentCount?: number;
}

interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
}

export default function StoryViewer({ stories, initialIndex = 0, onClose }: StoryViewerProps) {
  const [, setLocation] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showComments, setShowComments] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [commentText, setCommentText] = useState("");
  
  const { user } = useAuth();
  const story = stories[currentIndex];
  const isOwner = user?.id === story.userId;

  const recordView = trpc.stories.recordView.useMutation();
  const deleteStory = trpc.stories.delete.useMutation({
    onSuccess: () => {
      utils.stories.getActive.invalidate();
      utils.stories.getUserStories.invalidate({ userId: user?.id });
      utils.users.getRecent.invalidate();
      onClose();
    }
  });
  const addComment = trpc.stories.addComment.useMutation({
    onSuccess: () => {
      setCommentText("");
      utils.stories.getComments.invalidate({ storyId: story.id });
    }
  });
  
  const { data: comments = [] } = trpc.stories.getComments.useQuery(
    { storyId: story.id },
    { enabled: !!story.id }
  );

  const { data: viewers = [] } = trpc.stories.getViewers.useQuery(
    { storyId: story.id },
    { enabled: !!story.id && isOwner }
  );

  const utils = trpc.useUtils();

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (showComments) {
      const el = document.getElementById('comments-end');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length, showComments]);

  useEffect(() => {
    if (story.id && user) {
      recordView.mutate({ storyId: story.id });
    }
  }, [currentIndex, story.id, user]);

  const next = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const prev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment.mutate({ storyId: story.id, content: commentText }, {
      onSuccess: () => {
        setCommentText("");
        // Invalidate to show new comment
        utils.stories.getComments.invalidate({ storyId: story.id });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center select-none" dir="rtl">
      {/* Header */}
      <div className="absolute top-8 left-4 right-4 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border border-white/20">
            <AvatarImage src={story.userAvatar || ""} />
            <AvatarFallback>{story.userName?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-bold text-sm">{story.userName || 'مستخدم'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-white/80 text-xs bg-black/20 px-2 py-1 rounded-full">
            <Eye className="w-3 h-3" />
            <span>{story.viewCount || 0}</span>
          </div>
          {isOwner && (
            <button 
              onClick={() => {
                if (confirm("هل أنت متأكد من حذف هذه القصة؟")) {
                  deleteStory.mutate({ storyId: story.id });
                }
              }} 
              className="text-red-400 p-2 hover:bg-red-500/20 rounded-full"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button onClick={onClose} className="text-white p-2 hover:bg-white/10 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Media Content */}
      <div 
        className="w-full h-full flex items-center justify-center"
      >
        {story.mediaType === "video" ? (
          <video 
            src={story.mediaUrl} 
            className="max-w-full max-h-full object-contain" 
            autoPlay 
            playsInline
          />
        ) : (
          <img src={story.mediaUrl} className="max-w-full max-h-full object-contain" />
        )}
      </div>

      {/* Caption & Stats Overlay */}
      {!showComments && !showViewers && (
        <div className="absolute bottom-20 left-0 right-0 p-6 text-center bg-gradient-to-t from-black/80 to-transparent">
          {story.caption && <p className="text-white text-lg mb-4">{story.caption}</p>}
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => setShowComments(true)}
              className="flex items-center gap-2 text-white bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full backdrop-blur-sm"
            >
              <MessageCircle className="w-5 h-5" />
              <span>{comments.length} تعليق</span>
            </button>
            {isOwner && (
              <button 
                onClick={() => setShowViewers(true)}
                className="flex items-center gap-2 text-white bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full backdrop-blur-sm"
              >
                <Eye className="w-5 h-5" />
                <span>{viewers.length} مشاهدة</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Comments Panel */}
      {showComments && (
        <div className="absolute inset-x-0 bottom-0 top-1/2 bg-white rounded-t-3xl z-20 flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-lg">التعليقات ({comments.length})</h3>
            <button onClick={() => setShowComments(false)} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <MessageCircle className="w-12 h-12 opacity-20 mb-2" />
                <p className="text-sm">لا توجد تعليقات بعد</p>
              </div>
            ) : (
              [...comments].reverse().map((c: any) => (
                <div key={c.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Avatar 
                      className="w-10 h-10 border border-white shadow-sm cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => {
                        onClose();
                        setLocation(`/profile?userId=${c.userId}`);
                      }}
                    >
                      {c.userAvatar ? (
                        <AvatarImage src={c.userAvatar} className="object-cover" />
                      ) : (
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">
                          {c.userName?.charAt(0) || "U"}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white p-3.5 rounded-2xl rounded-tr-none shadow-sm border border-gray-100">
                      <p 
                        className="font-bold text-xs text-purple-600 mb-1 cursor-pointer hover:underline"
                        onClick={() => {
                          onClose();
                          setLocation(`/profile?userId=${c.userId}`);
                        }}
                      >
                        {c.userName || 'مستخدم'}
                      </p>
                      <p className="text-sm text-gray-800 leading-relaxed break-words">{c.content}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5 mr-2 font-medium">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: ar })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div id="comments-end" />
          </div>

          <div className="p-4 border-t bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
            <form onSubmit={handleSendComment} className="flex gap-2 items-end max-w-full">
              <div className="flex-1 relative">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="اكتب تعليقاً..."
                  rows={1}
                  className="w-full rounded-2xl bg-gray-100 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none min-h-[44px] max-h-[120px] overflow-y-auto"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendComment(e as any);
                    }
                  }}
                />
              </div>
              <Button 
                type="submit" 
                size="icon" 
                disabled={!commentText.trim() || addComment.isPending}
                className="rounded-full w-11 h-11 bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 flex-shrink-0"
              >
                <Send className="w-5 h-5 text-white" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Viewers Panel */}
      {showViewers && (
        <div className="absolute inset-x-0 bottom-0 top-1/2 bg-white rounded-t-3xl z-20 flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-lg">المشاهدات ({viewers.length})</h3>
            <button onClick={() => setShowViewers(false)} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {viewers.length === 0 ? (
                <p className="text-center text-gray-500 py-8">لا توجد مشاهدات بعد</p>
              ) : (
                viewers.map((v: any) => (
                  <div key={v.userId} className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={v.userAvatar || ""} />
                      <AvatarFallback>{v.userName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{v.userName || 'مستخدم'}</p>
                      <p className="text-[10px] text-gray-400">
                        {formatDistanceToNow(new Date(v.viewedAt), { addSuffix: true, locale: ar })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Controls */}
      {!showComments && !showViewers && (
        <>
          <button 
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-white"
          >
            <ChevronLeft className="w-10 h-10" />
          </button>
          <button 
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-white"
          >
            <ChevronRight className="w-10 h-10" />
          </button>
        </>
      )}
    </div>
  );
}
