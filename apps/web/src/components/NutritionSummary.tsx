import type { Nutrition } from '@health-tracker/shared';
import { roundNutrition } from '@health-tracker/shared';

type NutritionSummaryProps = {
  nutrition: Nutrition;
  compact?: boolean;
};

const labels = [
  { key: 'calories', label: 'kcal', digits: 0 },
  { key: 'protein', label: 'protein', digits: 1 },
  { key: 'carbs', label: 'carbs', digits: 1 },
  { key: 'fat', label: 'fat', digits: 1 },
  { key: 'fiber', label: 'fiber', digits: 1 },
] as const;

export function NutritionSummary({ nutrition, compact }: NutritionSummaryProps) {
  const rounded = roundNutrition(nutrition);

  return (
    <dl
      className={[
        'grid gap-x-4 gap-y-2',
        compact ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-5',
      ].join(' ')}
    >
      {labels.map((item) => {
        const value = rounded[item.key];
        const display =
          item.digits === 0 ? String(value) : value.toFixed(item.digits);
        return (
          <div key={item.key} className="min-w-0">
            <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              {item.label}
            </dt>
            <dd
              className={[
                'font-display font-bold tabular-nums text-ink',
                compact ? 'text-lg' : 'text-2xl',
              ].join(' ')}
            >
              {display}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
