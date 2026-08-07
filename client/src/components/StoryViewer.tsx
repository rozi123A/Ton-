import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";

interface Story {
  id: number;
  userId: number;
  mediaUrl: string;
  mediaType: string;
  caption?: string | null;
  userName?: string | null;
  userAvatar?: string | null;
}

interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
}

export default function StoryViewer({ stories, initialIndex = 0, onClose }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const story = stories[currentIndex];

  const DURATION = 5000; // 5 seconds per story

  useEffect(() => {
    if (isPaused) return;

    const interval = 50;
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex(currentIndex + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + (interval / DURATION) * 100;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused, stories.length, onClose]);

  const next = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const prev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center select-none" dir="ltr">
      {/* Progress Bars */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-1">
        {stories.map((_, idx) => (
          <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-100 ease-linear"
              style={{ 
                width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' 
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-8 left-4 right-4 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src={story.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(story.userName || 'user')}`} 
            className="w-10 h-10 rounded-full border border-white/20 object-cover"
          />
          <div>
            <p className="text-white font-bold text-sm">{story.userName || 'مستخدم'}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white p-2 hover:bg-white/10 rounded-full">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Media Content */}
      <div 
        className="w-full h-full flex items-center justify-center"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {story.mediaType === "video" ? (
          <video 
            src={story.mediaUrl} 
            className="max-w-full max-h-full object-contain" 
            autoPlay 
            playsInline
            onEnded={next}
          />
        ) : (
          <img src={story.mediaUrl} className="max-w-full max-h-full object-contain" />
        )}
      </div>

      {/* Caption */}
      {story.caption && (
        <div className="absolute bottom-12 left-0 right-0 p-6 text-center bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-white text-lg">{story.caption}</p>
        </div>
      )}

      {/* Controls */}
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
    </div>
  );
}
