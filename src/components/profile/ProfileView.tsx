'use client';

import { useCallback, useEffect, useState } from 'react';

interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  subscriptionTier: 'free' | 'paid';
  subscriptionStatus: 'active' | 'canceled' | 'past_due';
  createdAt: string | null;
}

interface FeatureAccess {
  aiDebrief: boolean;
  weeklyReview: boolean;
  maxPatterns: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ProfileView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/profile');
      if (!res.ok) throw new Error('Failed to load profile');
      const json = await res.json();
      setProfile(json.user);
      setAccess(json.access);
      setNameInput(json.user.displayName || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSaveName = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: nameInput }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setProfile({ ...profile, displayName: nameInput || null });
      setEditingName(false);
    } catch {
      setError('Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-4 rounded bg-red-bg border border-red/20 text-red text-sm font-mono">
        {error || 'Unable to load profile'}
      </div>
    );
  }

  const tierLabel = profile.subscriptionTier === 'paid' ? 'PRO' : 'FREE';
  const tierColor = profile.subscriptionTier === 'paid' ? 'text-green' : 'text-muted';
  const statusLabel = profile.subscriptionStatus === 'active' ? 'Active'
    : profile.subscriptionStatus === 'past_due' ? 'Past Due'
    : 'Canceled';
  const statusColor = profile.subscriptionStatus === 'active' ? 'text-green'
    : profile.subscriptionStatus === 'past_due' ? 'text-yellow'
    : 'text-red';

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-wide mb-2">PROFILE</h1>

      {/* User Info */}
      <div className="bg-panel rounded-lg border border-border overflow-hidden">
        <div className="panel-header px-5 py-3">
          <h2 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest">Account</h2>
        </div>
        <div className="p-5 space-y-4">
          {/* Email */}
          <div>
            <label className="text-[10px] text-muted uppercase tracking-widest font-mono font-bold block mb-1">Email</label>
            <p className="text-sm font-mono text-foreground">{profile.email}</p>
          </div>

          {/* Display Name */}
          <div>
            <label className="text-[10px] text-muted uppercase tracking-widest font-mono font-bold block mb-1">Display Name</label>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={100}
                  className="flex-1 px-3 py-1.5 text-sm font-mono rounded bg-surface border border-border text-foreground focus:outline-none focus:border-green/50"
                  placeholder="Enter display name"
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-mono font-bold rounded bg-green/10 text-green border border-green/20 hover:bg-green/20 transition-colors disabled:opacity-50"
                >
                  {saving ? '...' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingName(false); setNameInput(profile.displayName || ''); }}
                  className="px-3 py-1.5 text-xs font-mono font-bold rounded text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-foreground">{profile.displayName || '--'}</p>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-[10px] font-mono text-green hover:text-green/80 transition-colors"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Member Since */}
          <div>
            <label className="text-[10px] text-muted uppercase tracking-widest font-mono font-bold block mb-1">Member Since</label>
            <p className="text-sm font-mono text-foreground">{formatDate(profile.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-panel rounded-lg border border-border overflow-hidden">
        <div className="panel-header px-5 py-3">
          <h2 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest">Membership</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-[10px] text-muted uppercase tracking-widest font-mono font-bold block mb-1">Plan</label>
              <span className={`text-lg font-display tracking-wide ${tierColor}`}>{tierLabel}</span>
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-widest font-mono font-bold block mb-1">Status</label>
              <span className={`text-sm font-mono font-bold ${statusColor}`}>{statusLabel}</span>
            </div>
          </div>

          {/* Feature Access */}
          {access && (
            <div>
              <label className="text-[10px] text-muted uppercase tracking-widest font-mono font-bold block mb-2">Features</label>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <FeatureRow label="Pattern Detection" value={`${access.maxPatterns} of 4 types`} enabled={true} />
                <FeatureRow label="AI Debrief" value={access.aiDebrief ? 'Enabled' : 'Locked'} enabled={access.aiDebrief} />
                <FeatureRow label="Weekly Review" value={access.weeklyReview ? 'Enabled' : 'Locked'} enabled={access.weeklyReview} />
                <FeatureRow label="Scorecard" value={access.aiDebrief ? 'Enabled' : 'Locked'} enabled={access.aiDebrief} />
              </div>
            </div>
          )}

          {profile.subscriptionTier === 'free' && (
            <a
              href="/pricing"
              className="inline-block px-5 py-2.5 text-xs font-mono font-bold rounded bg-green text-background hover:bg-green/90 transition-colors"
            >
              UPGRADE TO PRO
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ label, value, enabled }: { label: string; value: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-green' : 'bg-muted/40'}`} />
      <span className="text-foreground">{label}</span>
      <span className={`ml-auto ${enabled ? 'text-green' : 'text-muted'}`}>{value}</span>
    </div>
  );
}
