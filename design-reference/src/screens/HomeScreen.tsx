import { useState } from 'react';
import { Post, AppActions } from '../types';
import { posts as allPosts, currentUser, users, CATEGORY_LABELS, CATEGORY_COLORS } from '../data';
import { PostCard, Avatar, StatusBar, Toast, CategoryChip } from '../components/SharedUI';
import { BellIcon, SearchIcon, CheckVerifiedIcon, FireIcon, LightningIcon } from '../components/Icons';
import GenzLogo from '../components/GenzLogo';
import genzBannerPng from '@/imports/GenZ_in_Action.png';

const BG = '#0B2239';
const CARD = '#11324D';
const ELEVATED = '#0D2A40';
const CYAN = '#00FFFF';
const CYAN_DIM = '#00BFBF';
const GOLD = '#FFD700';
const TEXT1 = '#FFFFFF';
const TEXT2 = '#CDE2F0';
const TEXT3 = '#4A7A9B';
const BORDER = 'rgba(0,200,200,0.15)';
const GREEN = '#32CD32';

const FILTERS = ['All', 'Climate', 'Equality', 'Mental Health', 'Education', 'Housing', 'Community', 'Arts', 'Tech'];

// Derive trending topics from post tags
const trendingTopics = [
  { tag: 'ClimateNow', posts: 847, color: '#4ADE80' },
  { tag: 'MentalHealthMatters', posts: 631, color: '#60A5FA' },
  { tag: 'GenZRising', posts: 512, color: CYAN },
  { tag: 'HousingForAll', posts: 389, color: '#FB923C' },
  { tag: 'EqualityNow', posts: 274, color: '#A78BFA' },
];

// Weekly milestones for the current user
const weeklyStats = [
  { label: 'Actions', value: 3, max: 5, icon: '⚡', color: CYAN },
  { label: 'Signed', value: 2, max: 4, icon: '✍️', color: GOLD },
  { label: 'Shared', value: 7, max: 10, icon: '📢', color: GREEN },
];

type HomeScreenProps = {
  savedPosts: Set<string>;
  likedPosts: Set<string>;
  followedUsers: Set<string>;
  actions: AppActions;
  unreadCount: number;
};

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export default function HomeScreen({ savedPosts, likedPosts, followedUsers, actions, unreadCount }: HomeScreenProps) {
  const [filter, setFilter] = useState('All');
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  };

  const filtered: Post[] = filter === 'All'
    ? allPosts
    : allPosts.filter(p => CATEGORY_LABELS[p.category] === filter);

  // Suggested users not yet followed
  const suggested = users.filter(u => !followedUsers.has(u.id)).slice(0, 3);

  // Featured post (first action type or first post)
  const featured = allPosts.find(p => p.type === 'action') ?? allPosts[0];

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 tablet-px" style={{ flexShrink: 0 }}>
        <div className="flex items-center justify-between">
          <button onClick={() => actions.onOpenMenu()} className="flex items-center active:opacity-70 transition-opacity" style={{ gap: 8 }}>
            <GenzLogo size="md" variant="mark" />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1, alignItems: 'flex-start' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 500, lineHeight: 1, color: TEXT3 }}>Welcome back 👋</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 900, lineHeight: 1, color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif", paddingLeft: 0 }}>
                {currentUser.displayName}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => actions.onNavigate('explore')}
              className="w-9 h-9 flex items-center justify-center rounded-full"
              style={{ background: ELEVATED }}
            >
              <SearchIcon size={18} color={TEXT3} />
            </button>
            <button
              onClick={actions.onOpenNotifications}
              className="w-9 h-9 flex items-center justify-center rounded-full relative"
              style={{ background: ELEVATED }}
            >
              <BellIcon size={18} color={TEXT3} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: '#FF5555' }}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => actions.onUserPress('me')}>
              <Avatar src={currentUser.avatar} size={36} />
            </button>
          </div>
        </div>
      </div>

      <div className="screen-body">

        {/* ── Weekly Impact Card ── */}
        <div className="px-5 mb-4">
          <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #0D2A40 0%, #071828 100%)', border: `1px solid rgba(0,255,255,0.18)` }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: CYAN }}>This Week's Impact</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>+240</span>
                  <span className="text-sm" style={{ color: TEXT2 }}>pts</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,255,255,0.1)' }}>
                  <span className="text-xs">🔥</span>
                  <span className="text-xs font-bold" style={{ color: CYAN }}>5-day streak</span>
                </div>
                <p className="text-xs" style={{ color: TEXT3 }}>Rank #142 globally</p>
              </div>
            </div>
            <div className="flex gap-3">
              {weeklyStats.map(s => (
                <div key={s.label} className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px]" style={{ color: TEXT3 }}>{s.label}</span>
                    <span className="text-[10px] font-bold" style={{ color: s.color }}>{s.value}/{s.max}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(s.value / s.max) * 100}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Featured Action ── */}
        <div className="px-5 mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-sm font-bold" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>🔥 Featured Action</p>
            <button onClick={() => actions.onPostPress(featured.id)} className="text-xs font-semibold" style={{ color: CYAN }}>See post →</button>
          </div>
          <button
            onClick={() => actions.onPostPress(featured.id)}
            className="w-full text-left rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${BORDER}`, boxShadow: '0 0 20px rgba(0,255,255,0.08)' }}
          >
            {featured.image && (
              <div className="relative">
                <img src={featured.image} alt={featured.title} className="w-full object-cover" style={{ aspectRatio: '16/7', maxHeight: 220 }} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(11,34,57,0.9) 0%, transparent 60%)' }} />
                <div className="absolute bottom-3 left-3 flex gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white" style={{ background: CYAN_DIM }}>Take Action</span>
                  <CategoryChip category={featured.category} small />
                </div>
              </div>
            )}
            <div className="p-3" style={{ background: CARD }}>
              <p className="text-sm font-bold mb-1 leading-tight" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {featured.title}
              </p>
              <div className="flex items-center gap-2">
                <Avatar src={featured.user.avatar} size={18} />
                <span className="text-xs" style={{ color: TEXT2 }}>{featured.user.displayName}</span>
                {featured.user.isVerified && <CheckVerifiedIcon size={11} />}
                <span style={{ color: TEXT3 }}>·</span>
                <span className="text-xs" style={{ color: TEXT3 }}>{formatNumber(featured.likes)} likes</span>
              </div>
            </div>
          </button>
        </div>

        {/* ── Suggested People ── */}
        {suggested.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between px-5 mb-2.5">
              <p className="text-sm font-bold" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>👥 People to Follow</p>
              <button onClick={() => actions.onOpenMenu('member-directory')} className="text-xs font-semibold" style={{ color: CYAN }}>See all →</button>
            </div>
            <div className="people-grid px-5">
              {suggested.map(u => (
                <button
                  key={u.id}
                  onClick={() => actions.onUserPress(u.id)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl w-[100px] md:w-auto"
                  style={{ background: CARD, border: `1px solid ${BORDER}` }}
                >
                  <div className="relative">
                    <Avatar src={u.avatar} size={48} />
                    {u.isVerified && (
                      <div className="absolute -bottom-0.5 -right-0.5">
                        <CheckVerifiedIcon size={14} />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold truncate w-full" style={{ color: TEXT1 }}>{u.displayName.split(' ')[0]}</p>
                    <p className="text-[10px]" style={{ color: TEXT3 }}>{formatNumber(u.followers)} followers</p>
                  </div>
                  <div className="w-full py-1.5 rounded-lg text-[10px] font-bold text-center" style={{ background: 'rgba(0,255,255,0.12)', color: CYAN }}>
                    Follow
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Trending Topics ── */}
        <div className="px-5 mb-4">
          <p className="text-sm font-bold mb-2.5" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>📈 Trending Right Now</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {trendingTopics.map((t, i) => (
              <div key={t.tag}>
                {i > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginLeft: 48 }} />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-sm font-black w-5 text-center" style={{ color: TEXT3 }}>#{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: TEXT1 }}>#{t.tag}</p>
                    <p className="text-[11px]" style={{ color: TEXT3 }}>{formatNumber(t.posts)} posts</p>
                  </div>
                  <div className="w-1.5 h-8 rounded-full" style={{ background: t.color, opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Feed Section ── */}
        <div className="px-5 mb-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>📋 Action Feed</p>
            <span className="text-xs" style={{ color: TEXT3 }}>{filtered.length} posts</span>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex gap-2 px-5 mb-4 overflow-x-auto" style={{ paddingBottom: 2 }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={filter === f
                ? { background: CYAN, color: BG }
                : { background: ELEVATED, color: TEXT2, border: `1px solid ${BORDER}` }
              }
            >
              {f}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div className="px-5 pb-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-8">
              <div className="text-5xl mb-3">🔍</div>
              <h3 className="text-base font-bold mb-1" style={{ color: TEXT1 }}>No posts in this category</h3>
              <p className="text-sm" style={{ color: TEXT2 }}>Try a different filter.</p>
            </div>
          ) : (
            <div className="feed-grid">
              {filtered.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  isLiked={likedPosts.has(post.id)}
                  isSaved={savedPosts.has(post.id)}
                  onLike={() => { actions.onLike(post.id); showToast(likedPosts.has(post.id) ? 'Removed like' : '❤️ Liked!'); }}
                  onSave={() => { actions.onSave(post.id); showToast(savedPosts.has(post.id) ? 'Removed from saved' : '🔖 Saved!'); }}
                  onPress={() => actions.onPostPress(post.id)}
                  onUserPress={() => actions.onUserPress(post.user.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Toast message={toast} visible={toastVisible} />
    </div>
  );
}
