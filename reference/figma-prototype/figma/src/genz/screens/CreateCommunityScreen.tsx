import { useState } from 'react';
import { Category } from '../types';
import { CATEGORY_LABELS, currentUser } from '../data';
import { Button, StatusBar, Avatar, Toast } from '../components/SharedUI';
import { ImageIcon, CloseIcon, CheckVerifiedIcon } from '../components/Icons';

// ─── Constants ───────────────────────────────────────────────

const BG      = '#0B2239';
const CARD    = '#11324D';
const ELEV    = '#0D2A40';
const CYAN    = '#00FFFF';
const CYAN_D  = '#00BFBF';
const GOLD    = '#FFD700';
const TEXT1   = '#FFFFFF';
const TEXT2   = '#CDE2F0';
const TEXT3   = '#4A7A9B';
const BORDER  = 'rgba(0,200,200,0.15)';

const CATEGORIES = (Object.entries(CATEGORY_LABELS) as [Category, string][]).map(
  ([id, label]) => ({ id, label })
);

type PrivacyLevel = 'public' | 'private' | 'invite';

const PRIVACY_OPTIONS: {
  id: PrivacyLevel;
  icon: string;
  label: string;
  tagline: string;
  desc: string;
  color: string;
  bg: string;
}[] = [
  {
    id: 'public',
    icon: '🌐',
    label: 'Public',
    tagline: 'Open to everyone',
    desc: 'Anyone can discover, join, and view posts. Best for broad movements and campaigns.',
    color: '#4ADE80',
    bg: 'rgba(74,222,128,0.08)',
  },
  {
    id: 'private',
    icon: '🔒',
    label: 'Private',
    tagline: 'Approval required',
    desc: 'Searchable but members must request to join. Posts are hidden from non-members.',
    color: '#00FFFF',
    bg: 'rgba(0,255,255,0.08)',
  },
  {
    id: 'invite',
    icon: '🛡️',
    label: 'Invite Only',
    tagline: 'Hidden & exclusive',
    desc: 'Not discoverable through search. New members can only join via a direct invite link.',
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.08)',
  },
];

const POSTING_RULES: { id: string; label: string; desc: string }[] = [
  { id: 'anyone', label: 'All members', desc: 'Any approved member can post' },
  { id: 'admins', label: 'Admins only', desc: 'Only admins and moderators can post' },
];

const MODERATION_RULES: { id: string; label: string; desc: string }[] = [
  { id: 'community', label: 'Community-led', desc: 'Members can flag content for review' },
  { id: 'admin', label: 'Admin-reviewed', desc: 'All posts require admin approval' },
];

type Step = 'basics' | 'category' | 'privacy' | 'review';
const STEPS: Step[] = ['basics', 'category', 'privacy', 'review'];
const STEP_LABELS = ['Basics', 'Category', 'Privacy', 'Review'];

type FormData = {
  name: string;
  tagline: string;
  description: string;
  category: Category;
  tags: string;
  privacy: PrivacyLevel;
  posting: string;
  moderation: string;
};

// ─── Component ───────────────────────────────────────────────

export default function CreateCommunityScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('basics');
  const [form, setForm] = useState<FormData>({
    name: '',
    tagline: '',
    description: '',
    category: 'community',
    tags: '',
    privacy: 'public',
    posting: 'anyone',
    moderation: 'community',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  const set = (field: keyof FormData) => (val: string) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: undefined }));
  };

  const stepIndex = STEPS.indexOf(step);

  const goBack = () => {
    if (stepIndex === 0) { onBack(); return; }
    setStep(STEPS[stepIndex - 1]);
  };

  const validateBasics = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Community name is required';
    else if (form.name.trim().length < 3) e.name = 'Name must be at least 3 characters';
    else if (form.name.trim().length > 50) e.name = 'Name must be under 50 characters';
    if (!form.description.trim()) e.description = 'Description is required';
    else if (form.description.trim().length < 20) e.description = 'Add a bit more detail (at least 20 characters)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setCreated(true); }, 1800);
  };

  const selectedPrivacy = PRIVACY_OPTIONS.find(p => p.id === form.privacy)!;

  // ── Success screen ──────────────────────────────────────────
  if (created) {
    return (
      <div className="screen flex flex-col items-center justify-center px-8 text-center" style={{ background: BG }}>
        <div className="text-6xl mb-5">🏘️</div>
        <h2 className="text-2xl font-black mb-2" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Community Created!
        </h2>
        <p className="text-sm mb-1" style={{ color: TEXT2 }}>
          <span style={{ color: CYAN, fontWeight: 700 }}>{form.name}</span> is live.
        </p>
        <p className="text-xs mb-8" style={{ color: GOLD }}>+50 impact points earned ⚡</p>

        {/* Community preview card */}
        <div className="w-full rounded-2xl overflow-hidden mb-8" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="h-20 w-full" style={{ background: 'linear-gradient(135deg, #005F5F, #0B2239)' }} />
          <div className="px-4 pb-4">
            <div className="-mt-6 mb-3 flex items-end justify-between">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border-4" style={{ background: ELEV, borderColor: BG }}>
                {CATEGORIES.find(c => c.id === form.category) ? getCategoryEmoji(form.category) : '🤝'}
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full mb-1" style={{ background: selectedPrivacy.bg, color: selectedPrivacy.color }}>
                {selectedPrivacy.icon} {selectedPrivacy.label}
              </span>
            </div>
            <h3 className="text-base font-black mb-0.5" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{form.name}</h3>
            {form.tagline && <p className="text-xs mb-2" style={{ color: CYAN }}>{form.tagline}</p>}
            <p className="text-xs mb-3 line-clamp-2" style={{ color: TEXT2 }}>{form.description}</p>
            <div className="flex items-center gap-3 text-xs" style={{ color: TEXT3 }}>
              <span><span style={{ color: TEXT1, fontWeight: 600 }}>1</span> member</span>
              <span>·</span>
              <span>{CATEGORY_LABELS[form.category]}</span>
            </div>
          </div>
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={() => { setCreated(false); onBack(); }}>
          Go to Community
        </Button>
        <Button variant="ghost" size="md" fullWidth className="mt-2" onClick={() => {
          setCreated(false);
          setStep('basics');
          setForm({ name: '', tagline: '', description: '', category: 'community', tags: '', privacy: 'public', posting: 'anyone', moderation: 'community' });
        }}>
          Create Another
        </Button>
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────
  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />

      {/* Header */}
      <div className="px-5 pt-4 pb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={goBack}
            className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: ELEV }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke={TEXT1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Create Community
            </h1>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,255,255,0.1)', color: CYAN }}>
            {stepIndex + 1}/{STEPS.length}
          </span>
        </div>

        {/* Step progress */}
        <div className="flex gap-1.5">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex-1 flex flex-col gap-1">
              <div className="h-1 rounded-full transition-all duration-300" style={{ background: i <= stepIndex ? CYAN_D : ELEV }} />
              <span className="text-[10px] font-medium" style={{ color: i <= stepIndex ? CYAN : TEXT3 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="screen-body px-5 pb-8">

        {/* ── Step 1: Basics ─────────────────────────────────── */}
        {step === 'basics' && (
          <div className="flex flex-col gap-5">
            <p className="text-sm" style={{ color: TEXT2 }}>
              Set up the basics for your community. You can always edit these later.
            </p>

            {/* Cover image placeholder */}
            <button
              className="w-full h-24 rounded-2xl flex flex-col items-center justify-center gap-2 border-dashed transition-all"
              style={{ background: CARD, border: '2px dashed rgba(0,200,200,0.25)', color: TEXT3 }}
            >
              <ImageIcon size={22} color={TEXT3} />
              <span className="text-xs font-medium">Add cover photo</span>
            </button>

            {/* Community name */}
            <div>
              <label className="text-sm font-semibold block mb-1.5" style={{ color: TEXT2 }}>
                Community Name <span style={{ color: '#FF5555' }}>*</span>
              </label>
              <input
                value={form.name}
                onChange={e => set('name')(e.target.value)}
                placeholder="e.g. Climate Action Collective"
                maxLength={50}
                className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
                style={{
                  background: ELEV,
                  color: TEXT1,
                  border: errors.name ? '1px solid #FF5555' : `1px solid rgba(255,255,255,0.1)`,
                  fontFamily: "'Inter', sans-serif",
                }}
              />
              <div className="flex justify-between mt-1">
                {errors.name
                  ? <p className="text-xs" style={{ color: '#FF5555' }}>{errors.name}</p>
                  : <span />}
                <p className="text-xs" style={{ color: TEXT3 }}>{form.name.length}/50</p>
              </div>
            </div>

            {/* Tagline */}
            <div>
              <label className="text-sm font-semibold block mb-1.5" style={{ color: TEXT2 }}>
                Tagline <span className="text-xs font-normal" style={{ color: TEXT3 }}>(optional)</span>
              </label>
              <input
                value={form.tagline}
                onChange={e => set('tagline')(e.target.value)}
                placeholder="One sentence that defines your mission"
                maxLength={80}
                className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
                style={{ background: ELEV, color: TEXT1, border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'Inter', sans-serif" }}
              />
              <p className="text-xs mt-1 text-right" style={{ color: TEXT3 }}>{form.tagline.length}/80</p>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-semibold block mb-1.5" style={{ color: TEXT2 }}>
                Description <span style={{ color: '#FF5555' }}>*</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => set('description')(e.target.value)}
                placeholder="What is this community about? What do members do together? Why should someone join?"
                rows={4}
                className="w-full px-4 py-3.5 rounded-xl text-sm outline-none resize-none"
                style={{
                  background: ELEV,
                  color: TEXT1,
                  border: errors.description ? '1px solid #FF5555' : '1px solid rgba(255,255,255,0.1)',
                  fontFamily: "'Inter', sans-serif",
                }}
              />
              <div className="flex justify-between mt-1">
                {errors.description
                  ? <p className="text-xs" style={{ color: '#FF5555' }}>{errors.description}</p>
                  : <span />}
                <p className="text-xs" style={{ color: TEXT3 }}>{form.description.length} chars</p>
              </div>
            </div>

            <Button variant="primary" size="lg" fullWidth onClick={() => { if (validateBasics()) setStep('category'); }}>
              Continue
            </Button>
          </div>
        )}

        {/* ── Step 2: Category ───────────────────────────────── */}
        {step === 'category' && (
          <div className="flex flex-col gap-5">
            <p className="text-sm" style={{ color: TEXT2 }}>
              Choose the primary cause that defines this community.
            </p>

            <div className="flex flex-col gap-2">
              {CATEGORIES.map(c => {
                const active = form.category === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => set('category')(c.id)}
                    className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-all"
                    style={{
                      background: active ? 'rgba(0,255,255,0.07)' : CARD,
                      border: active ? `1px solid ${CYAN_D}` : '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <span className="text-xl">{getCategoryEmoji(c.id)}</span>
                    <span className="flex-1 text-sm font-semibold" style={{ color: active ? CYAN : TEXT1 }}>
                      {c.label}
                    </span>
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: active ? CYAN_D : 'rgba(255,255,255,0.2)',
                        background: active ? CYAN_D : 'transparent',
                      }}
                    >
                      {active && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-semibold block mb-1.5" style={{ color: TEXT2 }}>
                Tags <span className="text-xs font-normal" style={{ color: TEXT3 }}>(optional, comma separated)</span>
              </label>
              <input
                value={form.tags}
                onChange={e => set('tags')(e.target.value)}
                placeholder="e.g. youth, local, advocacy, climate"
                className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
                style={{ background: ELEV, color: TEXT1, border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'Inter', sans-serif" }}
              />
            </div>

            <Button variant="primary" size="lg" fullWidth onClick={() => setStep('privacy')}>
              Continue
            </Button>
          </div>
        )}

        {/* ── Step 3: Privacy ────────────────────────────────── */}
        {step === 'privacy' && (
          <div className="flex flex-col gap-5">
            <p className="text-sm" style={{ color: TEXT2 }}>
              Who can find and join your community?
            </p>

            {/* Privacy option cards */}
            <div className="flex flex-col gap-3">
              {PRIVACY_OPTIONS.map(opt => {
                const active = form.privacy === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => set('privacy')(opt.id)}
                    className="w-full text-left rounded-2xl p-4 transition-all"
                    style={{
                      background: active ? opt.bg : CARD,
                      border: active ? `1px solid ${opt.color}40` : '1px solid rgba(255,255,255,0.07)',
                      boxShadow: active ? `0 0 24px ${opt.color}12` : 'none',
                    }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: active ? `${opt.color}18` : ELEV }}
                      >
                        {opt.icon}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold" style={{ color: active ? opt.color : TEXT1 }}>
                            {opt.label}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: active ? `${opt.color}20` : ELEV, color: active ? opt.color : TEXT3 }}>
                            {opt.tagline}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: TEXT2 }}>{opt.desc}</p>
                      </div>

                      {/* Radio */}
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          borderColor: active ? opt.color : 'rgba(255,255,255,0.2)',
                          background: active ? opt.color : 'transparent',
                        }}
                      >
                        {active && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Posting permissions */}
            <div>
              <label className="text-sm font-semibold block mb-2" style={{ color: TEXT2 }}>
                Who can post?
              </label>
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                {POSTING_RULES.map((rule, i) => {
                  const active = form.posting === rule.id;
                  return (
                    <button
                      key={rule.id}
                      onClick={() => set('posting')(rule.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                      style={{
                        background: active ? 'rgba(0,255,255,0.06)' : CARD,
                        borderBottom: i < POSTING_RULES.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: active ? CYAN_D : 'rgba(255,255,255,0.2)',
                          background: active ? CYAN_D : 'transparent',
                        }}
                      >
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: active ? CYAN : TEXT1 }}>{rule.label}</p>
                        <p className="text-xs" style={{ color: TEXT3 }}>{rule.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Moderation */}
            <div>
              <label className="text-sm font-semibold block mb-2" style={{ color: TEXT2 }}>
                Content moderation
              </label>
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                {MODERATION_RULES.map((rule, i) => {
                  const active = form.moderation === rule.id;
                  return (
                    <button
                      key={rule.id}
                      onClick={() => set('moderation')(rule.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                      style={{
                        background: active ? 'rgba(0,255,255,0.06)' : CARD,
                        borderBottom: i < MODERATION_RULES.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: active ? CYAN_D : 'rgba(255,255,255,0.2)',
                          background: active ? CYAN_D : 'transparent',
                        }}
                      >
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: active ? CYAN : TEXT1 }}>{rule.label}</p>
                        <p className="text-xs" style={{ color: TEXT3 }}>{rule.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button variant="primary" size="lg" fullWidth onClick={() => setStep('review')}>
              Review Community
            </Button>
          </div>
        )}

        {/* ── Step 4: Review ─────────────────────────────────── */}
        {step === 'review' && (
          <div className="flex flex-col gap-5">
            <p className="text-sm" style={{ color: TEXT2 }}>
              Review your community before it goes live.
            </p>

            {/* Community preview card */}
            <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="h-20" style={{ background: 'linear-gradient(135deg, #005F5F 0%, #071828 100%)' }} />
              <div className="px-4 pb-5">
                <div className="-mt-6 mb-3 flex items-end justify-between">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border-4" style={{ background: ELEV, borderColor: BG }}>
                    {getCategoryEmoji(form.category)}
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full mb-1" style={{ background: selectedPrivacy.bg, color: selectedPrivacy.color }}>
                    {selectedPrivacy.icon} {selectedPrivacy.label}
                  </span>
                </div>
                <h3 className="text-base font-black mb-0.5" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {form.name || 'Community Name'}
                </h3>
                {form.tagline
                  ? <p className="text-xs mb-2" style={{ color: CYAN }}>{form.tagline}</p>
                  : null}
                <p className="text-xs mb-3 line-clamp-2" style={{ color: TEXT2 }}>{form.description}</p>
                <div className="flex items-center gap-3 text-xs" style={{ color: TEXT3 }}>
                  <div className="flex items-center gap-1">
                    <Avatar src={currentUser.avatar} size={16} />
                    <span>Founded by <span style={{ color: TEXT2 }}>{currentUser.displayName}</span></span>
                  </div>
                  <span>·</span>
                  <span>{CATEGORY_LABELS[form.category]}</span>
                </div>
              </div>
            </div>

            {/* Settings summary */}
            <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-0" style={{ color: TEXT3 }}>Settings</p>
              </div>

              {[
                { label: 'Privacy', icon: selectedPrivacy.icon, value: selectedPrivacy.label, sub: selectedPrivacy.tagline, color: selectedPrivacy.color },
                { label: 'Posting', icon: '✏️', value: POSTING_RULES.find(r => r.id === form.posting)!.label, sub: POSTING_RULES.find(r => r.id === form.posting)!.desc, color: CYAN },
                { label: 'Moderation', icon: '🛡️', value: MODERATION_RULES.find(r => r.id === form.moderation)!.label, sub: MODERATION_RULES.find(r => r.id === form.moderation)!.desc, color: GOLD },
              ].map((row, i, arr) => (
                <div
                  key={row.label}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                >
                  <span className="text-base w-6 text-center">{row.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: TEXT3 }}>{row.label}</p>
                    <p className="text-sm font-semibold" style={{ color: TEXT1 }}>{row.value}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${row.color}15`, color: row.color }}>
                    {row.sub}
                  </span>
                </div>
              ))}
            </div>

            {/* Tags preview */}
            {form.tags && (
              <div className="flex flex-wrap gap-2">
                {form.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: ELEV, color: TEXT2, border: '1px solid rgba(255,255,255,0.08)' }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* CTA */}
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(0,255,255,0.06)', border: '1px solid rgba(0,255,255,0.15)' }}>
              <p className="text-sm font-semibold" style={{ color: CYAN }}>✅ Ready to launch</p>
              <p className="text-xs mt-0.5" style={{ color: TEXT2 }}>
                Your community will be {form.privacy === 'invite' ? 'visible only to invited members' : form.privacy === 'private' ? 'searchable but join-restricted' : 'open to all GenZ in Action users'}.
              </p>
            </div>

            <Button variant="primary" size="lg" fullWidth loading={loading} onClick={handleCreate}>
              Launch Community 🏘️
            </Button>
            <Button variant="ghost" size="md" fullWidth onClick={() => setStep('privacy')} className="mt-1">
              Edit Settings
            </Button>
          </div>
        )}
      </div>

      <Toast message={toast} visible={toastVisible} />
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
