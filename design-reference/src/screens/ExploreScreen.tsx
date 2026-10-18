import { useState, useMemo } from 'react';
import { AppActions } from '../types';
import { posts, users, trendingTags, CATEGORY_COLORS, CATEGORY_LABELS, suggestedUsers } from '../data';
import { PostCard, UserRow, StatusBar, CategoryChip } from '../components/SharedUI';
import { SearchIcon, CloseIcon, FireIcon } from '../components/Icons';

const CATEGORIES = ['climate', 'equality', 'mental-health', 'education', 'housing', 'community', 'arts', 'tech'] as const;

type ExploreScreenProps = {
  savedPosts: Set<string>;
  likedPosts: Set<string>;
  followedUsers: Set<string>;
  actions: AppActions;
};

type ExploreTab = 'discover' | 'trending' | 'people';

export default function ExploreScreen({ savedPosts, likedPosts, followedUsers, actions }: ExploreScreenProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ExploreTab>('discover');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const searchResults = useMemo(() => {
    if (!query.trim()) return { posts: [], users: [] };
    const q = query.toLowerCase();
    return {
      posts: posts.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.tags.some(t => t.includes(q)) ||
        CATEGORY_LABELS[p.category].toLowerCase().includes(q)
      ),
      users: users.filter(u =>
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.cause.toLowerCase().includes(q)
      ),
    };
  }, [query]);

  const isSearching = query.trim().length > 0;

  const filteredPosts = selectedCategory
    ? posts.filter(p => p.category === selectedCategory)
    : posts;

  return (
    <div className="screen" style={{ background: '#0B2239' }}>
      <StatusBar />

      <div className="px-5 pb-3">
        <h1 className="text-xl font-black mb-4" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Explore
        </h1>

        <div className="relative mb-4">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <SearchIcon size={18} color="#CDE2F0" />
          </div>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 100)}
            placeholder="Search actions, causes, people..."
            className="w-full pl-11 pr-10 py-3.5 rounded-2xl text-sm outline-none"
            style={{
              background: '#0D2A40',
              color: '#FFFFFF',
              border: focused ? '1px solid #00BFBF' : '1px solid rgba(255,255,255,0.08)',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2">
              <CloseIcon size={16} color="#CDE2F0" />
            </button>
          )}
        </div>

        {!isSearching && (
          <div className="flex gap-2">
            {(['discover', 'trending', 'people'] as ExploreTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2 text-sm font-semibold rounded-xl capitalize transition-all"
                style={tab === t
                  ? { background: '#00BFBF', color: 'white' }
                  : { background: '#0D2A40', color: '#CDE2F0' }
                }
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="screen-body">
        {isSearching ? (
          <div className="px-5 pb-6">
            {searchResults.users.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3" style={{ color: '#CDE2F0' }}>People</h3>
                <div className="rounded-2xl overflow-hidden divide-y" style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {searchResults.users.map(user => (
                    <div key={user.id} className="px-4">
                      <UserRow
                        user={user}
                        isFollowing={followedUsers.has(user.id)}
                        onFollow={() => actions.onFollow(user.id)}
                        onPress={() => actions.onUserPress(user.id)}
                        compact
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {searchResults.posts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: '#CDE2F0' }}>Actions</h3>
                <div className="feed-grid">
                  {searchResults.posts.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      isLiked={likedPosts.has(post.id)}
                      isSaved={savedPosts.has(post.id)}
                      onLike={() => actions.onLike(post.id)}
                      onSave={() => actions.onSave(post.id)}
                      onPress={() => actions.onPostPress(post.id)}
                      onUserPress={() => actions.onUserPress(post.user.id)}
                    />
                  ))}
                </div>
              </div>
            )}
            {searchResults.users.length === 0 && searchResults.posts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#FFFFFF' }}>No results for "{query}"</h3>
                <p className="text-sm" style={{ color: '#CDE2F0' }}>Try a different keyword or browse by category.</p>
              </div>
            )}
          </div>
        ) : tab === 'discover' ? (
          <div className="px-5 pb-6">
            <div className="mb-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#CDE2F0' }}>Browse by Category</h3>
              <div className="category-grid">
                {CATEGORIES.map(cat => {
                  const c = CATEGORY_COLORS[cat];
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(isSelected ? null : cat)}
                      className="flex items-center gap-3 p-4 rounded-2xl text-left transition-all"
                      style={{
                        background: isSelected ? c.bg : '#11324D',
                        border: `1px solid ${isSelected ? c.border : 'rgba(255,255,255,0.07)'}`,
                      }}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                        <span className="text-sm">{getCategoryEmoji(cat)}</span>
                      </div>
                      <span className="text-sm font-semibold" style={{ color: c.text }}>{CATEGORY_LABELS[cat]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedCategory && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold" style={{ color: '#CDE2F0' }}>
                    {CATEGORY_LABELS[selectedCategory as keyof typeof CATEGORY_LABELS]} Actions
                  </h3>
                  <button onClick={() => setSelectedCategory(null)} className="text-xs" style={{ color: '#00FFFF' }}>
                    See all
                  </button>
                </div>
                <div className="feed-grid">
                  {filteredPosts.slice(0, 4).map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      isLiked={likedPosts.has(post.id)}
                      isSaved={savedPosts.has(post.id)}
                      onLike={() => actions.onLike(post.id)}
                      onSave={() => actions.onSave(post.id)}
                      onPress={() => actions.onPostPress(post.id)}
                      onUserPress={() => actions.onUserPress(post.user.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : tab === 'trending' ? (
          <div className="px-5 pb-6">
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <FireIcon size={16} color="#FB923C" />
                <h3 className="text-sm font-semibold" style={{ color: '#CDE2F0' }}>Trending Tags</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {trendingTags.map((item, i) => (
                  <button
                    key={item.tag}
                    onClick={() => { setQuery(item.tag); }}
                    className="flex items-center justify-between p-4 rounded-2xl"
                    style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base font-black w-6 text-center" style={{ color: '#4A7A9B' }}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold" style={{ color: '#FFFFFF' }}>#{item.tag}</p>
                        <p className="text-xs" style={{ color: '#CDE2F0' }}>{item.count} posts</p>
                      </div>
                    </div>
                    <FireIcon size={16} color={i < 3 ? '#FB923C' : '#4A7A9B'} />
                  </button>
                ))}
              </div>
            </div>

            <h3 className="text-sm font-semibold mb-3" style={{ color: '#CDE2F0' }}>Top Actions This Week</h3>
            <div className="feed-grid">
              {posts.slice(9, 12).map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  isLiked={likedPosts.has(post.id)}
                  isSaved={savedPosts.has(post.id)}
                  onLike={() => actions.onLike(post.id)}
                  onSave={() => actions.onSave(post.id)}
                  onPress={() => actions.onPostPress(post.id)}
                  onUserPress={() => actions.onUserPress(post.user.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="px-5 pb-6">
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#CDE2F0' }}>Suggested Changemakers</h3>
            <div className="rounded-2xl overflow-hidden" style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}>
              {suggestedUsers.map((user, idx) => (
                <div key={user.id} className={`px-4 ${idx < suggestedUsers.length - 1 ? 'border-b' : ''}`} style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <UserRow
                    user={user}
                    isFollowing={followedUsers.has(user.id)}
                    onFollow={() => actions.onFollow(user.id)}
                    onPress={() => actions.onUserPress(user.id)}
                  />
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold mb-3 mt-6" style={{ color: '#CDE2F0' }}>All Changemakers</h3>
            <div className="people-cards-grid">
              {users.slice(0, 8).map(user => (
                <div
                  key={user.id}
                  className="rounded-2xl p-4"
                  style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-start gap-3">
                    <button onClick={() => actions.onUserPress(user.id)}>
                      <img src={user.avatar} alt={user.displayName} className="w-12 h-12 rounded-full object-cover" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-sm" style={{ color: '#FFFFFF' }}>{user.displayName}</span>
                            {user.isVerified && (
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                <path d="M6.5 2.5C7 1.5 9 1.5 9.5 2.5C10.1669 1.70017 12.0998 2.20017 12.5 3.5C13.5 3.8669 14 5.6998 13.2 6.5C13.8 7.5 13 9.3 12 9.5C12 10.5 11 12.2 9.5 12C9 13 7 13 6.5 12C5 12.2 4 10.5 4 9.5C3 9.3 2.2 7.5 2.8 6.5C2 5.6998 2.5 3.8669 3.5 3.5C3.9002 2.20017 5.8331 1.70017 6.5 2.5Z" fill="#00FFFF" />
                                <path d="M5.5 8L7 9.5L10.5 6" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <p className="text-xs" style={{ color: '#CDE2F0' }}>@{user.username}</p>
                        </div>
                        <button
                          onClick={() => actions.onFollow(user.id)}
                          className="text-xs font-semibold px-4 py-1.5 rounded-full"
                          style={followedUsers.has(user.id)
                            ? { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#CDE2F0' }
                            : { background: '#00BFBF', color: 'white' }
                          }
                        >
                          {followedUsers.has(user.id) ? 'Following' : 'Follow'}
                        </button>
                      </div>
                      <p className="text-xs mt-1.5 line-clamp-2" style={{ color: '#CDE2F0' }}>{user.bio}</p>
                      <div className="flex gap-4 mt-2">
                        <span className="text-xs" style={{ color: '#4A7A9B' }}>
                          <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{(user.followers / 1000).toFixed(1)}k</span> followers
                        </span>
                        <span className="text-xs" style={{ color: '#4A7A9B' }}>
                          <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{user.actionsCount}</span> actions
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getCategoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    climate: '🌊', equality: '✊', 'mental-health': '💙', education: '📚',
    housing: '🏠', community: '🤝', arts: '🎨', tech: '💻',
  };
  return map[cat] ?? '⚡';
}
