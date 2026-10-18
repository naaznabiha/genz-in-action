import { AppActions } from '../types';
import { currentUser } from '../data';
import { Avatar, StatusBar } from '../components/SharedUI';
import GenzLogo from '../components/GenzLogo';

const BG = '#0B2239';
const CARD = '#11324D';
const ELEVATED = '#0D2A40';
const CYAN = '#00FFFF';
const CYAN_DIM = '#00BFBF';
const TEXT1 = '#FFFFFF';
const TEXT2 = '#CDE2F0';
const TEXT3 = '#4A7A9B';
const BORDER = 'rgba(0,200,200,0.13)';

type MenuScreenProps = {
  actions: AppActions;
  onBack: () => void;
};

type MenuItem = {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onPress: () => void;
  accent: string;
};

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M9 18l6-6-6-6" stroke={TEXT3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke={CYAN} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 13h8M8 16h5" stroke={CYAN} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon2() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="17" rx="3" stroke="#FBBF24" strokeWidth="1.8" />
      <path d="M8 2v4M16 2v4M3 9h18" stroke="#FBBF24" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="14" r="1.2" fill="#FBBF24" />
      <circle cx="12" cy="14" r="1.2" fill="#FBBF24" />
      <circle cx="16" cy="14" r="1.2" fill="#FBBF24" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M9 18h6M10 21h4M12 2a7 7 0 015.66 11.19c-.55.71-1.66 1.81-1.66 3.81H8c0-2-.97-3.14-1.52-3.81A7 7 0 0112 2z" stroke="#A78BFA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="3.5" stroke="#4ADE80" strokeWidth="1.8" />
      <path d="M2 20c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="#4ADE80" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.5" stroke="#4ADE80" strokeWidth="1.6" />
      <path d="M21 20c0-2.76-1.79-5.11-4.24-5.8" stroke="#4ADE80" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}


export default function MenuScreen({ actions, onBack }: MenuScreenProps) {
  const menuItems: MenuItem[] = [
    {
      icon: <ProjectsIcon />,
      label: 'Projects Hub',
      sublabel: 'Browse and join active campaigns',
      accent: CYAN,
      onPress: () => actions.onOpenMenu('projects-hub'),
    },
    {
      icon: <CalendarIcon2 />,
      label: 'Meetings & Events',
      sublabel: 'Upcoming events and virtual meetups',
      accent: '#FBBF24',
      onPress: () => actions.onOpenMenu('meetings-events'),
    },
    {
      icon: <LightbulbIcon />,
      label: 'Resources Library',
      sublabel: 'Guides, toolkits, and learning materials',
      accent: '#A78BFA',
      onPress: () => actions.onOpenMenu('resources-library'),
    },
    {
      icon: <PeopleIcon />,
      label: 'Member Directory',
      sublabel: 'Find and connect with changemakers',
      accent: '#4ADE80',
      onPress: () => actions.onOpenMenu('member-directory'),
    },
  ];

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-3 pb-4" style={{ flexShrink: 0 }}>
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full"
          style={{ background: ELEVATED }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke={TEXT1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="text-lg font-black tracking-widest uppercase" style={{ color: CYAN, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '0.18em' }}>
          Menu
        </p>
        <div style={{ width: 36 }} />
      </div>

      <div className="screen-body px-5">
        <div style={{ height: 28 }} />

        {/* User card */}
        <button
          onClick={() => actions.onUserPress('me')}
          className="w-full flex items-center gap-4 p-4 rounded-2xl mb-6"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          <div className="relative">
            <Avatar src={currentUser.avatar} size={52} />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full" style={{ background: '#32CD32', border: `2px solid ${BG}` }} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-black text-base" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {currentUser.displayName}
            </p>
            <p className="text-sm" style={{ color: TEXT3 }}>@{currentUser.username}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,255,255,0.1)', color: CYAN }}>
                ⚡ {currentUser.impactPoints.toLocaleString()} pts
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: TEXT2 }}>
                {currentUser.cause}
              </span>
            </div>
          </div>
          <ChevronRight />
        </button>

        {/* Menu items */}
        <div className="rounded-2xl overflow-hidden mb-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          {menuItems.map((item, i) => (
            <div key={item.label}>
              {i > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginLeft: 68 }} />}
              <button
                onClick={item.onPress}
                className="w-full flex items-center gap-4 px-4 py-4 text-left active:opacity-70 transition-opacity"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.accent}14` }}
                >
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: TEXT1 }}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: TEXT3 }}>{item.sublabel}</p>
                </div>
                <ChevronRight />
              </button>
            </div>
          ))}
        </div>

        {/* Logo watermark */}
        <div className="flex flex-col items-center pb-8 pt-2">
          <GenzLogo size="md" variant="mark" />
        </div>
      </div>
    </div>
  );
}
