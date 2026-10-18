import React from 'react';
import { AppTab } from '../types';
import { HomeIcon, HomeFilledIcon, CompassIcon, CompassFilledIcon, PlusIcon, BookmarkIcon, BookmarkFilledIcon, PersonIcon, PersonFilledIcon } from './Icons';

type BottomNavProps = {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  unreadCount?: number;
};

export default function BottomNav({ activeTab, onTabChange, unreadCount = 0 }: BottomNavProps) {
  const tabs: { id: AppTab; label: string; icon: React.ReactNode; activeIcon: React.ReactNode }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <HomeIcon size={24} color="#4A7A9B" />,
      activeIcon: <HomeFilledIcon size={24} color="#00FFFF" />,
    },
    {
      id: 'explore',
      label: 'Explore',
      icon: <CompassIcon size={24} color="#4A7A9B" />,
      activeIcon: <CompassFilledIcon size={24} color="#00FFFF" />,
    },
    {
      id: 'create',
      label: '',
      icon: null,
      activeIcon: null,
    },
    {
      id: 'activity',
      label: 'Saved',
      icon: <BookmarkIcon size={24} color="#4A7A9B" />,
      activeIcon: <BookmarkFilledIcon size={24} color="#00FFFF" />,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <PersonIcon size={24} color="#4A7A9B" />,
      activeIcon: <PersonFilledIcon size={24} color="#00FFFF" />,
    },
  ];

  return (
    <div
      className="shrink-0"
      style={{
        background: 'rgba(8,8,15,0.97)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(0,200,200,0.1)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 20px), 20px)',
      }}
    >
      <div
        className="flex items-end justify-around px-3 pt-2 mx-auto"
        style={{ maxWidth: 640 }}
      >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        if (tab.id === 'create') {
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange('create')}
              className="flex flex-col items-center"
              style={{ marginTop: -20 }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                style={{
                  background: activeTab === 'create'
                    ? 'linear-gradient(135deg, #00BFBF, #00FFFF)'
                    : 'linear-gradient(135deg, #008888, #00BFBF)',
                  boxShadow: '0 4px 20px rgba(0,200,200,0.12)',
                }}
              >
                <PlusIcon size={24} color="white" />
              </div>
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex flex-col items-center gap-1 py-1 min-w-[44px] relative"
          >
            <div className="relative">
              {isActive ? tab.activeIcon : tab.icon}
              {tab.id === 'activity' && unreadCount > 0 && (
                <div
                  className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: '#FF5555' }}
                >
                  {unreadCount}
                </div>
              )}
            </div>
            <span
              className="text-[10px] font-medium"
              style={{ color: isActive ? '#00FFFF' : '#4A7A9B' }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
