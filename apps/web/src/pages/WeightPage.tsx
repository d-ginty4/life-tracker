import type { PreferredUnit, Settings, WeightEntry } from '@health-tracker/shared';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getSettings, updateSettings } from '../api/settings';
import { deleteWeight, listWeight, upsertWeight } from '../api/weight';
import { daysAgo, formatShortDisplayDate, todayLocal } from '../lib/dates';
import {
  displayToKg,
  formatWeight,
  kgToDisplay,
  weightUnitLabel,
} from '../lib/format';
import { Button, EmptyState, ErrorBanner, Field, PageHeader, TextInput, TextSelect, TextTextarea } from '../components/ui';

const RANGE_OPTIONS = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '180 days', days: 180 },
  { label: '1 year', days: 365 },
] as const;

export function WeightPage() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rangeDays, setRangeDays] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  const preferred: PreferredUnit = settings?.preferredUnit ?? 'kg';
  const [date, setDate] = useState(todayLocal());
  const [weightInput, setWeightInput] = useState('');
  const [notes, setNotes] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const [unitDraft, setUnitDraft] = useState<PreferredUnit>('kg');

  const from = daysAgo(rangeDays - 1);
  const to = todayLocal();

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [weightData, settingsData] = await Promise.all([
        listWeight(from, to),
        getSettings(),
      ]);
      setEntries(weightData.slice().sort((a, b) => a.date.localeCompare(b.date)));
      setSettings(settingsData);
      setUnitDraft(settingsData.preferredUnit);
      setGoalInput(
        settingsData.goalWeightKg != null
          ? kgToDisplay(settingsData.goalWeightKg, settingsData.preferredUnit).toFixed(1)
          : '',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weight data');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(
    () =>
      entries.map((entry) => ({
        date: entry.date,
        weight: Number(kgToDisplay(entry.weightKg, preferred).toFixed(2)),
        weightKg: entry.weightKg,
      })),
    [entries, preferred],
  );

  const goalDisplay =
    settings?.goalWeightKg != null
      ? Number(kgToDisplay(settings.goalWeightKg, preferred).toFixed(2))
      : null;

  const existingForDate = useMemo(
    () => entries.find((entry) => entry.date === date) ?? null,
    [entries, date],
  );

  useEffect(() => {
    if (existingForDate) {
      setWeightInput(kgToDisplay(existingForDate.weightKg, preferred).toFixed(1));
      setNotes(existingForDate.notes ?? '');
      return;
    }
    setWeightInput('');
    setNotes('');
  }, [existingForDate, preferred]);

  /** Floor the Y axis at the goal so progress reads as distance above it. */
  const yDomain = useMemo((): [number | 'auto', number | 'auto'] => {
    if (goalDisplay == null || chartData.length === 0) return ['auto', 'auto'];
    const peak = Math.max(goalDisplay, ...chartData.map((point) => point.weight));
    const paddedTop = peak + Math.max((peak - goalDisplay) * 0.08, 0.5);
    return [goalDisplay, Number(paddedTop.toFixed(2))];
  }, [chartData, goalDisplay]);

  async function onSaveEntry(event: FormEvent) {
    event.preventDefault();
    const value = Number(weightInput);
    if (!(value > 0)) {
      setError('Enter a weight greater than zero.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertWeight({
        date,
        weightKg: displayToKg(value, preferred),
        notes: notes.trim() ? notes.trim() : null,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save weight');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveSettings(event: FormEvent) {
    event.preventDefault();
    setSavingGoal(true);
    setError(null);
    try {
      const goalWeightKg =
        goalInput.trim() === '' ? null : displayToKg(Number(goalInput), unitDraft);
      const next = await updateSettings({
        goalWeightKg,
        preferredUnit: unitDraft,
      });
      setSettings(next);
      setGoalInput(
        next.goalWeightKg != null
          ? kgToDisplay(next.goalWeightKg, next.preferredUnit).toFixed(1)
          : '',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSavingGoal(false);
    }
  }

  async function onDelete(entry: WeightEntry) {
    if (!window.confirm(`Delete weigh-in from ${entry.date}?`)) return;
    setError(null);
    try {
      await deleteWeight(entry.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete weigh-in');
    }
  }

  return (
    <section>
      <PageHeader
        title="Weight"
        description="Log weigh-ins and track progress against your goal. Default chart range is 90 days."
      />
      <ErrorBanner message={error} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="font-display text-xl font-bold text-ink">Progress</p>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              Range
              <TextSelect
                value={rangeDays}
                onChange={(event) => setRangeDays(Number(event.target.value))}
                className="w-auto"
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.days} value={option.days}>
                    {option.label}
                  </option>
                ))}
              </TextSelect>
            </label>
          </div>

          <div className="h-72 w-full rounded-2xl border border-line bg-white/50 px-2 py-4 sm:px-4">
            {loading ? (
              <p className="px-2 text-sm text-ink-soft">Loading…</p>
            ) : chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-ink-soft">No weigh-ins in this range yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="rgba(20,36,31,0.08)" strokeDasharray="3 6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#3a524a', fontSize: 10 }}
                    tickMargin={8}
                    minTickGap={48}
                    tickFormatter={(value: string) => formatShortDisplayDate(value)}
                  />
                  <YAxis
                    domain={yDomain}
                    tick={{ fill: '#3a524a', fontSize: 11 }}
                    width={48}
                    unit={` ${weightUnitLabel(preferred)}`}
                    allowDataOverflow
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid rgba(20,36,31,0.12)',
                      background: '#f3f7f5',
                    }}
                    labelFormatter={(label) => formatShortDisplayDate(String(label))}
                    formatter={(value) => [
                      `${Number(value).toFixed(1)} ${preferred}`,
                      'Weight',
                    ]}
                  />
                  {goalDisplay != null ? (
                    <ReferenceLine
                      y={goalDisplay}
                      stroke="#1b5f52"
                      strokeDasharray="6 4"
                      label={{
                        value: 'Goal',
                        fill: '#1b5f52',
                        fontSize: 12,
                        position: 'insideTopRight',
                      }}
                    />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#c45c3a"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#c45c3a', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {entries.length === 0 && !loading ? (
            <EmptyState>Log a weigh-in to populate the chart.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {[...entries].reverse().map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-ink">
                      {formatShortDisplayDate(entry.date)} · {formatWeight(entry.weightKg, preferred)}
                    </p>
                    {entry.notes ? (
                      <p className="text-ink-soft">{entry.notes}</p>
                    ) : null}
                  </div>
                  <Button variant="ghost" onClick={() => void onDelete(entry)}>
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-8">
          <form className="space-y-3" onSubmit={(event) => void onSaveEntry(event)}>
            <p className="font-display text-lg font-bold text-ink">Log weight</p>
            <p className="text-xs text-ink-soft">
              One weigh-in per day. Saving the same date replaces the existing entry.
            </p>
            <Field label="Date">
              <TextInput
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field label={`Weight (${weightUnitLabel(preferred)})`}>
              <TextInput
                type="number"
                min={0.1}
                step="0.1"
                required
                value={weightInput}
                onChange={(event) => setWeightInput(event.target.value)}
                placeholder={preferred === 'kg' ? '78.2' : '172.4'}
              />
            </Field>
            <Field label="Notes" hint="Optional">
              <TextTextarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
            <Button type="submit" disabled={saving} className="w-full">
              {saving
                ? 'Saving…'
                : existingForDate
                  ? 'Update weigh-in'
                  : 'Save weigh-in'}
            </Button>
          </form>

          <form className="space-y-3 border-t border-line pt-8" onSubmit={(event) => void onSaveSettings(event)}>
            <p className="font-display text-lg font-bold text-ink">Goal & unit</p>
            <Field label="Display unit">
              <TextSelect
                value={unitDraft}
                onChange={(event) => setUnitDraft(event.target.value as PreferredUnit)}
              >
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </TextSelect>
            </Field>
            <Field
              label={`Goal weight (${weightUnitLabel(unitDraft)})`}
              hint="Leave blank to clear the goal"
            >
              <TextInput
                type="number"
                min={0.1}
                step="0.1"
                value={goalInput}
                onChange={(event) => setGoalInput(event.target.value)}
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={savingGoal} className="w-full">
              {savingGoal ? 'Saving…' : 'Save settings'}
            </Button>
          </form>
        </aside>
      </div>
    </section>
  );
}
