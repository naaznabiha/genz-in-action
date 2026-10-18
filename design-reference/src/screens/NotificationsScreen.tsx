import { useState } from 'react';
import { AppNotification } from '../types';
import { notifications as allNotifications } from '../data';
import { Avatar, StatusBar } from '../components/SharedUI';

type NotificationsScreenProps = {
  readNotifications: Set<string>;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onBack: () => void;
  onUserPress: (id: string) => void;
  onPostPress: (id: string) => void;
};

const TYPE_ICONS: Record<string, string> = {
  like: '❤️',
  comment: '💬',
  follow: '👤',
  mention: '@',
  milestone: '🏆',
};

export default function NotificationsScreen({ readNotifications, onMarkRead, onMarkAllRead, onBack, onUserPress, onPostPress }: NotificationsScreenProps) {
  const [notifs, setNotifs] = useState<AppNotification[]>(allNotifications);

  const unreadCount = notifs.filter(n => !readNotifications.has(n.id)).length;

  const handlePress = (n: AppNotification) => {
    onMarkRead(n.id);
    if (n.postId) onPostPress(n.postId);
    else if (n.user) onUserPress(n.user.id);
  };

  return (
    <div className="screen" style={{ background: '#0B2239' }}>
      <StatusBar />

      <div className="px-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: '#0D2A40' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <h1 className="text-xl font-black" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Notifications</h1>
          </div>
          {unreadCount > 0 && (
            <button onClick={onMarkAllRead} className="text-xs font-semibold" style={{ color: '#00FFFF' }}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="screen-body">
        {unreadCount > 0 && (
          <div className="px-5 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#CDE2F0' }}>
              New ({unreadCount})
            </p>
          </div>
        )}

        <div>
          {notifs.map((n) => {
            const isRead = readNotifications.has(n.id);
            return (
              <button
                key={n.id}
                onClick={() => handlePress(n)}
                className="w-full flex items-start gap-4 px-5 py-4 text-left transition-colors"
                style={{ background: isRead ? 'transparent' : 'rgba(124,58,237,0.06)' }}
              >
                <div className="relative flex-shrink-0">
                  {n.user ? (
                    <Avatar src={n.user.avatar} size={44} />
                  ) : (
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-2xl" style={{ background: '#0D2A40' }}>
                      {TYPE_ICONS[n.type] ?? '🔔'}
                    </div>
                  )}
                  {n.type !== 'milestone' && (
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                      style={{ background: '#11324D', border: '1.5px solid #0B2239' }}
                    >
                      {TYPE_ICONS[n.type]}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug" style={{ color: isRead ? '#CDE2F0' : '#FFFFFF' }}>
                    {n.message}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#4A7A9B' }}>{n.timestamp}</p>
                </div>

                {!isRead && (
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ background: '#00BFBF' }} />
                )}
              </button>
            );
          })}
        </div>

        {notifs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <div className="text-5xl mb-4">🔔</div>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#FFFFFF' }}>All caught up!</h3>
            <p className="text-sm" style={{ color: '#CDE2F0' }}>You have no new notifications right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
