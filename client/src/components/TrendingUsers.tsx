import { Heart, Eye, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

const MOCK_USERS = [
  { id: "m1", name: "سارة", age: 22, online: true, views: 1250, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sara" },
  { id: "m2", name: "احمد", age: 25, online: true, views: 980, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed" },
  { id: "m3", name: "فاطمة", age: 20, online: true, views: 1540, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Fatima" },
  { id: "m4", name: "محمد", age: 23, online: true, views: 1120, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mohammed" },
  { id: "m5", name: "ليلى", age: 21, online: true, views: 1890, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Layla" },
  { id: "m6", name: "علي", age: 24, online: true, views: 2100, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ali" },
];

function randomViews(id: number) {
  return 200 + (id * 137) % 1800;
}

export default function TrendingUsers() {
  const { data: realUsers, isLoading } = trpc.users.getRecent.useQuery(20, {
    staleTime: 30_000,
  });

  const hasRealUsers = realUsers && realUsers.length > 0;

  const displayUsers = hasRealUsers
    ? realUsers.map(u => ({
        id: String(u.id),
        name: u.name || 'مستخدم',
        age: u.age ?? 0,
        online: true,
        views: randomViews(u.id),
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
              <div
                key={user.id}
                className="group relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-pink-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-6 flex flex-col items-center text-center">
                  <div className="relative mb-4">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-20 h-20 rounded-full border-4 border-purple-200 shadow-lg object-cover bg-white"
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
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4 text-purple-600" />
                      <span>{user.views}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="w-4 h-4 text-pink-600" />
                      <span>نشط</span>
                    </div>
                  </div>

                  <button
                    onClick={() => window.location.href = '/chat'}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-2 px-4 rounded-lg hover:from-purple-700 hover:to-pink-600 transition-all duration-300 transform hover:scale-105"
                  >
                    ابدا الدردشة
                  </button>
                </div>
              </div>
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
