import {
  scaleNutrition,
  sumNutrition,
  type DiaryEntry,
  type DiaryEntryItem,
  type Ingredient,
  type Meal,
  type Nutrition,
} from '@health-tracker/shared';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createDiaryEntry,
  deleteDiaryEntry,
  getDiaryDay,
  updateDiaryEntry,
} from '../api/diary';
import { listIngredients } from '../api/ingredients';
import { listMeals } from '../api/meals';
import { Modal } from '../components/Modal';
import { NutritionSummary } from '../components/NutritionSummary';
import { addDays, formatDisplayDate, isValidCalendarDate, todayLocal } from '../lib/dates';
import {
  formatAmount,
  formatNutritionLine,
  ingredientBasis,
  previewScale,
} from '../lib/format';
import { Button, EmptyState, ErrorBanner, Field, PageHeader, TextInput, TextSelect } from '../components/ui';

type MealDraftAmount = { mealItemId: string; amount: number; defaultAmount: number };

export function DiaryPage() {
  const params = useParams();
  const navigate = useNavigate();
  const dateParam = params.date;
  const date = dateParam && isValidCalendarDate(dateParam) ? dateParam : todayLocal();

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [totals, setTotals] = useState<Nutrition>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });
  const [meals, setMeals] = useState<Meal[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [selectedMealId, setSelectedMealId] = useState('');
  const [mealAmounts, setMealAmounts] = useState<MealDraftAmount[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [ingredientAmount, setIngredientAmount] = useState(1);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [editAmounts, setEditAmounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const selectedMeal = useMemo(
    () => meals.find((meal) => meal.id === selectedMealId) ?? null,
    [meals, selectedMealId],
  );

  const selectedIngredient = useMemo(
    () => ingredients.find((ingredient) => ingredient.id === selectedIngredientId) ?? null,
    [ingredients, selectedIngredientId],
  );

  const mealPreview = useMemo(() => {
    if (!selectedMeal) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    }
    const ingredientLookup = new Map(
      ingredients.map((ingredient) => [ingredient.id, ingredient]),
    );
    const parts = selectedMeal.items.map((item) => {
      const draft = mealAmounts.find((row) => row.mealItemId === item.id);
      const amount = draft?.amount ?? item.defaultAmount;
      const ingredient = ingredientLookup.get(item.ingredientId);
      if (!ingredient) {
        return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      }
      return previewScale(ingredientBasis(ingredient), amount);
    });
    return sumNutrition(parts);
  }, [selectedMeal, mealAmounts, ingredients]);

  const ingredientPreview = useMemo(() => {
    if (!selectedIngredient) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    }
    return previewScale(ingredientBasis(selectedIngredient), ingredientAmount);
  }, [selectedIngredient, ingredientAmount]);

  const editPreview = useMemo(() => {
    if (!editingEntry) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    }
    const parts = editingEntry.items.map((item) => {
      const amount = editAmounts[item.id] ?? item.amount;
      return previewScale(
        {
          basisAmount: item.basisAmount,
          basisUnit: item.basisUnit,
          basis: item.basis,
        },
        amount,
      );
    });
    return sumNutrition(parts);
  }, [editingEntry, editAmounts]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [day, mealData, ingredientData] = await Promise.all([
        getDiaryDay(date),
        listMeals(),
        listIngredients(),
      ]);
      setEntries(day.entries);
      setTotals(day.totals);
      setMeals(mealData.slice().sort((a, b) => a.name.localeCompare(b.name)));
      setIngredients(ingredientData.slice().sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diary');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (dateParam && !isValidCalendarDate(dateParam)) {
      navigate('/', { replace: true });
    }
  }, [dateParam, navigate]);

  function goTo(next: string) {
    navigate(next === todayLocal() ? '/' : `/diary/${next}`);
  }

  function openAddMeal() {
    const first = meals[0];
    setSelectedMealId(first?.id ?? '');
    setMealAmounts(
      first
        ? first.items.map((item) => ({
            mealItemId: item.id,
            amount: item.defaultAmount,
            defaultAmount: item.defaultAmount,
          }))
        : [],
    );
    setMealModalOpen(true);
  }

  function onMealSelect(mealId: string) {
    const meal = meals.find((row) => row.id === mealId);
    setSelectedMealId(mealId);
    setMealAmounts(
      meal
        ? meal.items.map((item) => ({
            mealItemId: item.id,
            amount: item.defaultAmount,
            defaultAmount: item.defaultAmount,
          }))
        : [],
    );
  }

  function openAddIngredient() {
    const first = ingredients[0];
    setSelectedIngredientId(first?.id ?? '');
    setIngredientAmount(first?.basisUnit === 'unit' ? 1 : first?.basisAmount ?? 100);
    setIngredientModalOpen(true);
  }

  function openEdit(entry: DiaryEntry) {
    setEditingEntry(entry);
    setEditAmounts(
      Object.fromEntries(entry.items.map((item) => [item.id, item.amount])),
    );
    setEditModalOpen(true);
  }

  async function saveMealEntry(event: FormEvent) {
    event.preventDefault();
    if (!selectedMealId) return;
    setSaving(true);
    setError(null);
    const overrides = mealAmounts
      .filter((row) => row.amount !== row.defaultAmount)
      .map(({ mealItemId, amount }) => ({ mealItemId, amount }));
    try {
      await createDiaryEntry({
        date,
        type: 'meal',
        mealId: selectedMealId,
        items: overrides,
      });
      setMealModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log meal');
    } finally {
      setSaving(false);
    }
  }

  async function saveIngredientEntry(event: FormEvent) {
    event.preventDefault();
    if (!selectedIngredientId) return;
    setSaving(true);
    setError(null);
    try {
      await createDiaryEntry({
        date,
        type: 'ingredient',
        ingredientId: selectedIngredientId,
        amount: ingredientAmount,
      });
      setIngredientModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log ingredient');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingEntry) return;
    setSaving(true);
    setError(null);
    try {
      await updateDiaryEntry(editingEntry.id, {
        items: editingEntry.items.map((item) => ({
          id: item.id,
          amount: editAmounts[item.id] ?? item.amount,
        })),
      });
      setEditModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update entry');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(entry: DiaryEntry) {
    if (!window.confirm(`Remove “${entry.name}” from this day?`)) return;
    setError(null);
    try {
      await deleteDiaryEntry(entry.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  }

  const isToday = date === todayLocal();

  return (
    <section>
      <PageHeader
        title={isToday ? 'Today' : 'Diary'}
        description={formatDisplayDate(date)}
        actions={
          <>
            <Button variant="secondary" onClick={() => goTo(addDays(date, -1))}>
              Previous
            </Button>
            <TextInput
              type="date"
              value={date}
              onChange={(event) => {
                if (isValidCalendarDate(event.target.value)) goTo(event.target.value);
              }}
              className="w-auto"
              aria-label="Choose date"
            />
            <Button variant="secondary" onClick={() => goTo(addDays(date, 1))}>
              Next
            </Button>
            {!isToday ? (
              <Button variant="ghost" onClick={() => goTo(todayLocal())}>
                Today
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-8 rounded-2xl border border-leaf-soft bg-gradient-to-br from-leaf-soft/70 to-white/50 px-5 py-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-leaf">
          Day totals
        </p>
        <NutritionSummary nutrition={totals} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={openAddMeal} disabled={meals.length === 0}>
          Add meal
        </Button>
        <Button variant="secondary" onClick={openAddIngredient} disabled={ingredients.length === 0}>
          Add ingredient
        </Button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState>
          Nothing logged for this day. Add a meal or a single ingredient to get started.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {entries.map((entry) => (
            <li key={entry.id} className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="font-display text-lg font-bold text-ink">{entry.name}</p>
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
                      {entry.type}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {formatNutritionLine(entry.nutrition)}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
                    {entry.items.map((item) => (
                      <EntryItemLine key={item.id} item={item} />
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => openEdit(entry)}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => void onDelete(entry)}>
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={mealModalOpen} title="Log meal" onClose={() => setMealModalOpen(false)} wide>
        <form className="space-y-4" onSubmit={(event) => void saveMealEntry(event)}>
          <Field label="Meal">
            <TextSelect
              required
              value={selectedMealId}
              onChange={(event) => onMealSelect(event.target.value)}
            >
              {meals.map((meal) => (
                <option key={meal.id} value={meal.id}>
                  {meal.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          {selectedMeal ? (
            <div className="space-y-3">
              {selectedMeal.items.map((item) => {
                const draft = mealAmounts.find((row) => row.mealItemId === item.id);
                const amount = draft?.amount ?? item.defaultAmount;
                const ingredient = ingredients.find((row) => row.id === item.ingredientId);
                const line = ingredient
                  ? scaleNutrition(ingredientBasis(ingredient), amount)
                  : null;
                return (
                  <div
                    key={item.id}
                    className="grid gap-2 rounded-xl border border-line bg-white/40 p-3 sm:grid-cols-[1fr_8rem]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.ingredientName}</p>
                      <p className="text-xs text-ink-soft">
                        default {formatAmount(item.defaultAmount, item.basisUnit)}
                        {item.basisUnit === 'unit' ? ' unit' : ''}
                        {line ? ` · ${formatNutritionLine(line)}` : ''}
                      </p>
                    </div>
                    <TextInput
                      type="number"
                      min={0.001}
                      step="any"
                      required
                      value={amount}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setMealAmounts((prev) =>
                          prev.map((row) =>
                            row.mealItemId === item.id ? { ...row, amount: next } : row,
                          ),
                        );
                      }}
                      aria-label={`${item.ingredientName} amount`}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="rounded-xl border border-leaf-soft bg-leaf-soft/40 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-leaf">
              Preview
            </p>
            <NutritionSummary nutrition={mealPreview} compact />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMealModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !selectedMealId}>
              {saving ? 'Saving…' : 'Log meal'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={ingredientModalOpen}
        title="Log ingredient"
        onClose={() => setIngredientModalOpen(false)}
      >
        <form className="space-y-4" onSubmit={(event) => void saveIngredientEntry(event)}>
          <Field label="Ingredient">
            <TextSelect
              required
              value={selectedIngredientId}
              onChange={(event) => {
                const id = event.target.value;
                const next = ingredients.find((row) => row.id === id);
                setSelectedIngredientId(id);
                setIngredientAmount(next?.basisUnit === 'unit' ? 1 : next?.basisAmount ?? 100);
              }}
            >
              {ingredients.map((ingredient) => (
                <option key={ingredient.id} value={ingredient.id}>
                  {ingredient.name}
                </option>
              ))}
            </TextSelect>
          </Field>
          <Field
            label="Amount"
            hint={
              selectedIngredient
                ? `Basis ${selectedIngredient.basisAmount}${selectedIngredient.basisUnit === 'unit' ? ' unit' : selectedIngredient.basisUnit}`
                : undefined
            }
          >
            <TextInput
              type="number"
              min={0.001}
              step="any"
              required
              value={ingredientAmount}
              onChange={(event) => setIngredientAmount(Number(event.target.value))}
            />
          </Field>
          <div className="rounded-xl border border-leaf-soft bg-leaf-soft/40 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-leaf">
              Preview
            </p>
            <NutritionSummary nutrition={ingredientPreview} compact />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIngredientModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !selectedIngredientId}>
              {saving ? 'Saving…' : 'Log ingredient'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editModalOpen}
        title={editingEntry ? `Edit ${editingEntry.name}` : 'Edit entry'}
        onClose={() => setEditModalOpen(false)}
        wide
      >
        {editingEntry ? (
          <form className="space-y-4" onSubmit={(event) => void saveEdit(event)}>
            <div className="space-y-3">
              {editingEntry.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2 rounded-xl border border-line bg-white/40 p-3 sm:grid-cols-[1fr_8rem]"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.ingredientName}</p>
                    <p className="text-xs text-ink-soft">
                      snapshot · {item.basisAmount}
                      {item.basisUnit === 'unit' ? ' unit' : item.basisUnit} basis
                    </p>
                  </div>
                  <TextInput
                    type="number"
                    min={0.001}
                    step="any"
                    required
                    value={editAmounts[item.id] ?? item.amount}
                    onChange={(event) =>
                      setEditAmounts((prev) => ({
                        ...prev,
                        [item.id]: Number(event.target.value),
                      }))
                    }
                    aria-label={`${item.ingredientName} amount`}
                  />
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-leaf-soft bg-leaf-soft/40 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-leaf">
                Preview from snapshot
              </p>
              <NutritionSummary nutrition={editPreview} compact />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </section>
  );
}

function EntryItemLine({ item }: { item: DiaryEntryItem }) {
  return (
    <li>
      {item.ingredientName} · {formatAmount(item.amount, item.basisUnit)}
      {item.basisUnit === 'unit' ? ' unit' : ''} · {formatNutritionLine(item.nutrition)}
    </li>
  );
}
