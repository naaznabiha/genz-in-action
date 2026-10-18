import { useState } from 'react';
import { AppActions } from '../types';
import { posts as allPosts } from '../data';
import { PostCard, StatusBar, EmptyState } from '../components/SharedUI';

type ActivityTab = 'saved' | 'liked';

type ActivityScreenProps = {
  savedPosts: Set<string>;
  likedPosts: Set<string>;
  actions: AppActions;
};

export default function ActivityScreen({ savedPosts, likedPosts, actions }: ActivityScreenProps) {
  const [tab, setTab] = useState<ActivityTab>('saved');

  const savedList = allPosts.filter(p => savedPosts.has(p.id));
  const likedList = allPosts.filter(p => likedPosts.has(p.id));
  const displayList = tab === 'saved' ? savedList : likedList;

  return (
    <div className="screen" style={{ background: '#0B2239' }}>
      <StatusBar />

      <div className="px-5 pb-4">
        <h1 className="text-xl font-black mb-4" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Activity
        </h1>

        <div className="flex gap-2">
          {(['saved', 'liked'] as ActivityTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all"
              style={tab === t
                ? { background: '#00BFBF', color: 'white' }
                : { background: '#0D2A40', color: '#CDE2F0' }
              }
            >
              {t === 'saved' ? `Saved (${savedList.length})` : `Liked (${likedList.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="screen-body px-5 pb-6">
        {displayList.length === 0 ? (
          <EmptyState
            emoji={tab === 'saved' ? '🔖' : '❤️'}
            title={tab === 'saved' ? 'Nothing saved yet' : 'No liked posts yet'}
            subtitle={tab === 'saved'
              ? 'Tap the bookmark icon on any action to save it for later.'
              : 'Tap the heart on actions you care about to track them here.'
            }
            action={
              <button
                onClick={() => actions.onNavigate('home')}
                className="px-6 py-3 rounded-xl text-sm font-semibold"
                style={{ background: '#00BFBF', color: 'white' }}
              >
                Explore Actions
              </button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {displayList.map(post => (
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
        )}
      </div>
    </div>
  );
}
