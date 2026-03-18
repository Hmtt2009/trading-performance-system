'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { PatternCard } from '@/components/patterns/PatternCard';
import { ScorecardView } from '@/components/scorecard/ScorecardView';
import { CostOfBehaviorView } from '@/components/cost/CostOfBehaviorView';
import { SessionTimeline } from '@/components/timeline/SessionTimeline';
import { DebriefView } from '@/components/debrief/DebriefView';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { UpgradePrompt } from '@/components/UpgradePrompt';

interface FeatureAccess {
  aiDebrief: boolean;
  weeklyReview: boolean;
  maxPatterns: number;
}

const TABS = [
  { key: 'patterns', label: 'Patterns' },
  { key: 'scorecard', label: 'Scorecard' },
  { key: 'cost', label: 'Cost' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'debrief', label: 'AI Debrief' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface PatternData {
  id: string;
  pattern_type: string;
  confidence: 'high' | 'medium';
  dollar_impact: number | null;
  description: string | null;
  detection_data: Record<string, unknown> | null;
  trading_sessions: { session_date: string } | null;
}

function PatternsTab() {
  const [patterns, setPatterns] = useState<PatternData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analysis/patterns');
      if (!res.ok) throw new Error('Failed to load patterns');
      const json = await res.json();
      setPatterns(json.patterns || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load patterns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPatterns(); }, [fetchPatterns]);

  const handleDismiss = (id: string) => {
    setPatterns((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded bg-red-bg border border-red/20 text-red text-sm font-mono">{error}</div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="text-center py-16 text-muted">
        <svg className="w-12 h-12 mx-auto mb-4 text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-lg font-medium">No patterns detected</p>
        <p className="text-sm mt-1 font-mono">Upload more trades to detect behavioral patterns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted font-mono">{patterns.length} active patterns</p>
      {patterns.map((p) => (
        <PatternCard
          key={p.id}
          id={p.id}
          patternType={p.pattern_type}
          confidence={p.confidence}
          dollarImpact={p.dollar_impact}
          description={p.description}
          sessionDate={p.trading_sessions?.session_date}
          onDismiss={handleDismiss}
          detectionData={p.detection_data}
        />
      ))}
    </div>
  );
}

function TimelineTab() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-[10px] text-muted font-mono uppercase tracking-wider">Session Date:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-1.5 text-xs font-mono rounded bg-surface border border-border text-foreground focus:outline-none focus:border-green/50 [color-scheme:dark]"
        />
      </div>
      <SessionTimeline date={date} />
    </div>
  );
}

function DebriefTab() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-[10px] text-muted font-mono uppercase tracking-wider">Session Date:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-1.5 text-xs font-mono rounded bg-surface border border-border text-foreground focus:outline-none focus:border-green/50 [color-scheme:dark]"
        />
      </div>
      <DebriefView date={date} />
    </div>
  );
}

const PAID_TABS: TabKey[] = ['scorecard', 'cost', 'debrief'];

function AnalysisContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get('tab');
  const activeTab = TABS.some(t => t.key === rawTab) ? (rawTab as TabKey) : 'patterns';
  const setTab = (tab: TabKey) => { router.push(`/analysis?tab=${tab}`); };

  const [access, setAccess] = useState<FeatureAccess | null>(null);

  useEffect(() => {
    fetch('/api/user/profile')
      .then(res => res.ok ? res.json() : null)
      .then(json => { if (json?.access) setAccess(json.access); })
      .catch(() => {});
  }, []);

  const isPaidTab = (tab: TabKey) => PAID_TABS.includes(tab);
  const isLocked = (tab: TabKey) => isPaidTab(tab) && access !== null && !access.aiDebrief;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl tracking-wide">ANALYSIS</h1>

      {/* Tab navigation */}
      <div className="flex bg-surface rounded border border-border p-0.5 gap-0.5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`px-4 py-2 text-xs font-mono font-bold whitespace-nowrap rounded transition-colors flex items-center gap-1.5 ${
              activeTab === tab.key
                ? 'bg-panel text-green border border-green/20'
                : 'text-muted hover:text-foreground border border-transparent'
            }`}
          >
            {tab.label}
            {isLocked(tab.key) && (
              <svg className="w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'patterns' && <PatternsTab />}
        {activeTab === 'scorecard' && (isLocked('scorecard') ? <UpgradePrompt feature="Scorecard" /> : <ScorecardView />)}
        {activeTab === 'cost' && (isLocked('cost') ? <UpgradePrompt feature="Cost of Behavior Analysis" /> : <CostOfBehaviorView />)}
        {activeTab === 'timeline' && <TimelineTab />}
        {activeTab === 'debrief' && (isLocked('debrief') ? <UpgradePrompt feature="AI Debrief" /> : <DebriefTab />)}
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <AuthGuard>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <AnalysisContent />
        </Suspense>
      </div>
    </AuthGuard>
  );
}
