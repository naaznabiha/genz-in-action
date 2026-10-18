import { useState } from 'react';
import { Category, PostType } from '../types';
import { CATEGORY_LABELS, currentUser } from '../data';
import { Button, StatusBar, Avatar, Toast } from '../components/SharedUI';
import { ImageIcon, MapPinIcon, CalendarIcon, CloseIcon } from '../components/Icons';

const POST_TYPES: { id: PostType; label: string; emoji: string; desc: string; color: string }[] = [
  { id: 'action', label: 'Take Action', emoji: '⚡', desc: 'Call to action or campaign', color: '#00BFBF' },
  { id: 'event', label: 'Event', emoji: '📅', desc: 'In-person or virtual event', color: '#0EA5E9' },
  { id: 'petition', label: 'Petition', emoji: '✍️', desc: 'Signature drive or demand', color: '#FF5555' },
  { id: 'story', label: 'Story', emoji: '📖', desc: 'Share your experience', color: '#F59E0B' },
];

const CATEGORIES = (Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([id, label]) => ({ id, label }));

type Step = 'type' | 'content' | 'details' | 'preview';

type FormData = {
  type: PostType;
  title: string;
  body: string;
  category: Category;
  location: string;
  eventDate: string;
  goal: string;
  tags: string;
};

export default function CreateScreen({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<Step>('type');
  const [form, setForm] = useState<FormData>({
    type: 'action',
    title: '',
    body: '',
    category: 'climate',
    location: '',
    eventDate: '',
    goal: '',
    tags: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [published, setPublished] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  };

  const update = (field: keyof FormData) => (val: string) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: undefined }));
  };

  const validateContent = () => {
    const e: typeof errors = {};
    if (!form.title.trim()) e.title = 'Title is required';
    else if (form.title.length < 10) e.title = 'Title must be at least 10 characters';
    if (!form.body.trim()) e.body = 'Description is required';
    else if (form.body.length < 30) e.body = 'Please add more detail (at least 30 characters)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePublish = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setPublished(true);
    }, 2000);
  };

  if (published) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-8 text-center" style={{ background: '#0B2239' }}>
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-2xl font-black mb-3" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Action Published!
        </h2>
        <p className="text-sm mb-2" style={{ color: '#CDE2F0' }}>
          Your post is live and reaching changemakers right now.
        </p>
        <p className="text-xs mb-8" style={{ color: '#FFD700' }}>+25 impact points earned ⚡</p>
        <div className="rounded-2xl p-5 w-full mb-8" style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3 mb-3">
            <Avatar src={currentUser.avatar} size={36} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{currentUser.displayName}</p>
              <p className="text-xs" style={{ color: '#CDE2F0' }}>Just now</p>
            </div>
          </div>
          <h3 className="text-base font-bold mb-1" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{form.title}</h3>
          <p className="text-xs line-clamp-2" style={{ color: '#CDE2F0' }}>{form.body}</p>
        </div>
        <Button variant="primary" size="lg" fullWidth onClick={() => { setPublished(false); setStep('type'); setForm({ type: 'action', title: '', body: '', category: 'climate', location: '', eventDate: '', goal: '', tags: '' }); onSuccess(); }}>
          Back to Feed
        </Button>
      </div>
    );
  }

  const stepIndex = ['type', 'content', 'details', 'preview'].indexOf(step);
  const stepLabels = ['Type', 'Content', 'Details', 'Preview'];

  return (
    <div className="screen" style={{ background: '#0B2239' }}>
      <StatusBar />

      <div className="px-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-black" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Create Action</h1>
          {step !== 'type' && (
            <button onClick={() => setStep(s => {
              const steps: Step[] = ['type', 'content', 'details', 'preview'];
              const i = steps.indexOf(s);
              return steps[Math.max(0, i - 1)];
            })} className="text-sm" style={{ color: '#CDE2F0' }}>
              Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className="flex-1 h-1.5 rounded-full transition-all"
                style={{ background: i <= stepIndex ? '#00BFBF' : '#0D2A40' }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          {stepLabels.map((label, i) => (
            <span key={i} className="text-[10px]" style={{ color: i <= stepIndex ? '#00FFFF' : '#4A7A9B' }}>{label}</span>
          ))}
        </div>
      </div>

      <div className="screen-body px-5 pb-6">
        {step === 'type' && (
          <div>
            <p className="text-sm mb-4" style={{ color: '#CDE2F0' }}>What kind of action are you creating?</p>
            <div className="flex flex-col gap-3">
              {POST_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { update('type')(t.id); setStep('content'); }}
                  className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all"
                  style={{
                    background: form.type === t.id ? '#0D2A40' : '#11324D',
                    border: form.type === t.id ? `1px solid ${t.color}` : '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `${t.color}20` }}>
                    {t.emoji}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#FFFFFF' }}>{t.label}</p>
                    <p className="text-xs" style={{ color: '#CDE2F0' }}>{t.desc}</p>
                  </div>
                  <div className="ml-auto">
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: form.type === t.id ? t.color : 'rgba(255,255,255,0.2)', background: form.type === t.id ? t.color : 'transparent' }}>
                      {form.type === t.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'content' && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: '#CDE2F0' }}>Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => update('category')(c.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={form.category === c.id
                      ? { background: '#00BFBF', color: 'white' }
                      : { background: '#0D2A40', color: '#CDE2F0', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: '#CDE2F0' }}>
                Title <span style={{ color: '#FF5555' }}>*</span>
              </label>
              <input
                value={form.title}
                onChange={e => update('title')(e.target.value)}
                placeholder="Write a clear, compelling title..."
                className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
                style={{
                  background: '#0D2A40',
                  color: '#FFFFFF',
                  border: errors.title ? '1px solid #FF5555' : '1px solid rgba(255,255,255,0.1)',
                }}
              />
              {errors.title && <p className="text-xs mt-1" style={{ color: '#FF5555' }}>{errors.title}</p>}
              <p className="text-xs mt-1 text-right" style={{ color: '#4A7A9B' }}>{form.title.length}/100</p>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: '#CDE2F0' }}>
                Description <span style={{ color: '#FF5555' }}>*</span>
              </label>
              <textarea
                value={form.body}
                onChange={e => update('body')(e.target.value)}
                placeholder="Tell the story. Why does this matter? What can people do? Be specific and inspiring."
                rows={5}
                className="w-full px-4 py-3.5 rounded-xl text-sm outline-none resize-none"
                style={{
                  background: '#0D2A40',
                  color: '#FFFFFF',
                  border: errors.body ? '1px solid #FF5555' : '1px solid rgba(255,255,255,0.1)',
                  fontFamily: "'Inter', sans-serif",
                }}
              />
              {errors.body && <p className="text-xs mt-1" style={{ color: '#FF5555' }}>{errors.body}</p>}
              <p className="text-xs mt-1 text-right" style={{ color: '#4A7A9B' }}>{form.body.length} chars</p>
            </div>

            <button
              className="flex items-center gap-3 p-4 rounded-xl border-dashed"
              style={{ background: '#11324D', border: '2px dashed rgba(255,255,255,0.1)', color: '#CDE2F0' }}
            >
              <ImageIcon size={18} color="#CDE2F0" />
              <span className="text-sm">Add photo or video</span>
            </button>

            <Button variant="primary" size="lg" fullWidth disabled={!form.title || !form.body} onClick={() => { if (validateContent()) setStep('details'); }}>
              Continue
            </Button>
          </div>
        )}

        {step === 'details' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: '#CDE2F0' }}>Add optional details to help people take action.</p>

            {(form.type === 'event') && (
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: '#CDE2F0' }}>
                  <span className="flex items-center gap-1.5"><CalendarIcon size={14} color="#CDE2F0" /> Event Date & Time</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.eventDate}
                  onChange={e => update('eventDate')(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0D2A40', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: '#CDE2F0' }}>
                <span className="flex items-center gap-1.5"><MapPinIcon size={14} color="#CDE2F0" /> Location (optional)</span>
              </label>
              <input
                value={form.location}
                onChange={e => update('location')(e.target.value)}
                placeholder="City, State or Online"
                className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
                style={{ background: '#0D2A40', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            {form.type === 'petition' && (
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: '#CDE2F0' }}>Signature Goal</label>
                <input
                  type="number"
                  value={form.goal}
                  onChange={e => update('goal')(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0D2A40', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: '#CDE2F0' }}>Tags (comma separated)</label>
              <input
                value={form.tags}
                onChange={e => update('tags')(e.target.value)}
                placeholder="e.g. climate, action, portland"
                className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
                style={{ background: '#0D2A40', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            <Button variant="primary" size="lg" fullWidth onClick={() => setStep('preview')}>
              Preview
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div>
            <p className="text-sm mb-4" style={{ color: '#CDE2F0' }}>Here is how your action will look to others.</p>

            <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="p-4">
                <div className="flex gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white" style={{ background: POST_TYPES.find(t => t.id === form.type)?.color ?? '#00BFBF' }}>
                    {POST_TYPES.find(t => t.id === form.type)?.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <Avatar src={currentUser.avatar} size={32} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{currentUser.displayName}</p>
                    <p className="text-xs" style={{ color: '#CDE2F0' }}>@{currentUser.username} · Just now</p>
                  </div>
                </div>

                <h3 className="text-base font-bold mb-2" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {form.title || 'Your title goes here'}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#CDE2F0' }}>
                  {form.body || 'Your description goes here...'}
                </p>

                {form.location && (
                  <div className="flex items-center gap-1.5 mt-3 text-xs" style={{ color: '#CDE2F0' }}>
                    <MapPinIcon size={12} color="#CDE2F0" />
                    <span>{form.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl p-4 mb-6" style={{ background: '#0D2A40', border: '1px solid #0D2A40' }}>
              <p className="text-sm font-semibold" style={{ color: '#FFD700' }}>✅ Ready to publish</p>
              <p className="text-xs mt-1" style={{ color: '#CDE2F0' }}>Your action will be visible to all Actionr users immediately.</p>
            </div>

            <Button variant="primary" size="lg" fullWidth loading={loading} onClick={handlePublish}>
              Publish Action ⚡
            </Button>
            <Button variant="ghost" size="md" fullWidth onClick={() => setStep('content')} className="mt-2">
              Edit
            </Button>
          </div>
        )}
      </div>

      <Toast message={toast} visible={toastVisible} />
    </div>
  );
}
