import { Heart, Eye, Loader2, UserCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

const MOCK_USERS = [
  { id: 1, name: "سارة",    age: 22, online: true, profileViews: 1250, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sara"      },
  { id: 2, name: "احمد",    age: 25, online: true, profileViews: 980,  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed"     },
  { id: 3, name: "فاطمة",   age: 20, online: true, profileViews: 1540, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Fatima"    },
  { id: 4, name: "محمد",    age: 23, online: true, profileViews: 1120, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mohammed"  },
  { id: 5, name: "ليلى",    age: 21, online: true, profileViews: 1890, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Layla"     },
  { id: 6, name: "علي",     age: 24, online: true, profileViews: 2100, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ali"       },
];

/** A single user card that records a real view when it enters the viewport */
function UserCard({ user }: { user: typeof MOCK_USERS[0] }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(false);
  const recordView = trpc.users.recordView.useMutation();

  useEffect(() => {
    if (user.id < 0) return; // mock user — skip
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewedRef.current) {
          viewedRef.current = true;
          recordView.mutate(user.id);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  return (
    <div
      ref={cardRef}
      className="group relative bg-white rounded-[2.5rem] overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_60px_rgba(124,58,237,0.12)] transition-all duration-500 hover:-translate-y-3 cursor-pointer border border-gray-100/50"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-pink-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative p-6 flex flex-col items-center text-center">
        <div className="relative mb-4">
          <img
            src={user.avatar}
            alt={user.name}
            className="w-24 h-24 rounded-full border-4 border-white shadow-xl object-cover bg-white group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`;
            }}
          />
          {user.online && (
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg" />
          )}
        </div>

        <h3 className="font-bold text-lg text-gray-900 mb-1">{user.name}</h3>
        {user.age > 0 && (
          <p className="text-sm text-gray-600 mb-4">{user.age} سنة</p>
        )}

        <div className="flex items-center justify-center gap-4 text-sm text-gray-600 mb-4">
          {/* Profile visits counter — real visits from the DB */}
          <div className="flex items-center gap-1" title="عدد زيارات الملف الشخصي">
            <UserCheck className="w-4 h-4 text-purple-600" />
            <span className="font-semibold text-purple-700">{user.profileViews.toLocaleString('ar')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart className="w-4 h-4 text-pink-600" />
            <span>نشط</span>
          </div>
        </div>

        <button
          onClick={() => window.location.href = '/chat'}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold py-3 px-4 rounded-2xl hover:from-purple-700 hover:to-pink-600 transition-all duration-300 shadow-lg shadow-purple-200 group-hover:shadow-purple-300"
        >
          ابدا الدردشة
        </button>
      </div>
    </div>
  );
}

export default function TrendingUsers() {
  const { data: realUsers, isLoading } = trpc.users.getRecent.useQuery(20, {
    staleTime: 30_000,
  });

  const hasRealUsers = realUsers && realUsers.length > 0;

  const displayUsers = hasRealUsers
    ? realUsers.map(u => ({
        id: u.id,
        name: u.name || 'مستخدم',
        age: u.age ?? 0,
        online: true,
        profileViews: u.profileViews ?? 0,
        avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.name || String(u.id))}`,
      }))
    : MOCK_USERS;

  return (
    <section className="py-20 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
            المستخدمون النشطون الان
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            {hasRealUsers
              ? `${realUsers.length} مستخدم مسجل — تواصل معهم الان`
              : "تواصل مع اشخاص حقيقيين يبحثون عن محادثات حقيقية الان"}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayUsers.map((user) => (
              <UserCard key={user.id} user={user} />
            ))}
          </div>
        )}

        {hasRealUsers && realUsers.length >= 20 && (
          <div className="text-center mt-12">
            <button className="inline-block bg-white border-2 border-purple-600 text-purple-600 font-bold py-3 px-8 rounded-full hover:bg-purple-50 transition-all duration-300">
              عرض المزيد من المستخدمين
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
