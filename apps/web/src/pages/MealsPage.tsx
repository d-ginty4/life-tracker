import {
  scaleNutrition,
  sumNutrition,
  type Ingredient,
  type Meal,
  type MealInput,
} from '@health-tracker/shared';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { listIngredients } from '../api/ingredients';
import { createMeal, deleteMeal, listMeals, updateMeal } from '../api/meals';
import { Modal } from '../components/Modal';
import { NutritionSummary } from '../components/NutritionSummary';
import { formatAmount, formatNutritionLine, ingredientBasis } from '../lib/format';
import { Button, EmptyState, ErrorBanner, Field, PageHeader, TextInput, TextSelect, TextTextarea } from '../components/ui';

type DraftItem = {
  key: string;
  id?: string;
  ingredientId: string;
  defaultAmount: number;
};

function newKey(): string {
  return crypto.randomUUID();
}

export function MealsPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Meal | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  const ingredientMap = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  );

  const liveNutrition = useMemo(() => {
    const parts = items.flatMap((item) => {
      const ingredient = ingredientMap.get(item.ingredientId);
      if (!ingredient || !(item.defaultAmount > 0)) return [];
      return [scaleNutrition(ingredientBasis(ingredient), item.defaultAmount)];
    });
    return sumNutrition(parts);
  }, [items, ingredientMap]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mealData, ingredientData] = await Promise.all([listMeals(), listIngredients()]);
      setMeals(mealData.slice().sort((a, b) => a.name.localeCompare(b.name)));
      setIngredients(ingredientData.slice().sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName('');
    setNotes(null);
    setItems([
      {
        key: newKey(),
        ingredientId: ingredients[0]?.id ?? '',
        defaultAmount: ingredients[0]?.basisUnit === 'unit' ? 1 : 100,
      },
    ]);
    setEditorOpen(true);
  }

  function openEdit(meal: Meal) {
    setEditing(meal);
    setName(meal.name);
    setNotes(meal.notes);
    setItems(
      meal.items.map((item) => ({
        key: item.id,
        id: item.id,
        ingredientId: item.ingredientId,
        defaultAmount: item.defaultAmount,
      })),
    );
    setEditorOpen(true);
  }

  function addItem() {
    const first = ingredients[0];
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        ingredientId: first?.id ?? '',
        defaultAmount: first?.basisUnit === 'unit' ? 1 : 100,
      },
    ]);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (items.length === 0 || items.some((item) => !item.ingredientId)) {
      setError('Add at least one ingredient with a valid selection.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload: MealInput = {
      name,
      notes,
      items: items.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        ingredientId: item.ingredientId,
        defaultAmount: item.defaultAmount,
      })),
    };
    try {
      if (editing) {
        await updateMeal(editing.id, payload);
      } else {
        await createMeal(payload);
      }
      setEditorOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meal');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(meal: Meal) {
    if (!window.confirm(`Delete meal “${meal.name}”? Past diary entries keep their snapshots.`)) {
      return;
    }
    setError(null);
    try {
      await deleteMeal(meal.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meal');
    }
  }

  return (
    <section>
      <PageHeader
        title="Meals"
        description="Reusable templates with default amounts. Nutrition always reflects today’s ingredient definitions."
        actions={
          <Button onClick={openCreate} disabled={ingredients.length === 0}>
            Add meal
          </Button>
        }
      />
      <ErrorBanner message={error} />

      {ingredients.length === 0 && !loading ? (
        <EmptyState>Create ingredients first, then compose them into meals.</EmptyState>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : meals.length === 0 && ingredients.length > 0 ? (
        <EmptyState>No meals yet. Build one from your ingredient library.</EmptyState>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {meals.map((meal) => (
            <li key={meal.id} className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold text-ink">{meal.name}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{formatNutritionLine(meal.nutrition)}</p>
                  <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
                    {meal.items.map((item) => (
                      <li key={item.id}>
                        {item.ingredientName} · {formatAmount(item.defaultAmount, item.basisUnit)}
                        {item.basisUnit === 'unit' ? ' unit' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => openEdit(meal)}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => void onDelete(meal)}>
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editorOpen}
        title={editing ? 'Edit meal' : 'New meal'}
        onClose={() => setEditorOpen(false)}
        wide
      >
        <form className="space-y-4" onSubmit={(event) => void onSave(event)}>
          <Field label="Name">
            <TextInput required value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Notes" hint="Optional">
            <TextTextarea
              value={notes ?? ''}
              onChange={(event) => setNotes(event.target.value || null)}
            />
          </Field>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Ingredients</p>
              <Button type="button" variant="secondary" onClick={addItem}>
                Add item
              </Button>
            </div>
            {items.map((item, index) => {
              const ingredient = ingredientMap.get(item.ingredientId);
              return (
                <div
                  key={item.key}
                  className="grid gap-2 rounded-xl border border-line bg-white/40 p-3 sm:grid-cols-[1fr_7rem_auto]"
                >
                  <TextSelect
                    required
                    value={item.ingredientId}
                    onChange={(event) => {
                      const ingredientId = event.target.value;
                      const next = ingredientMap.get(ingredientId);
                      setItems((prev) =>
                        prev.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                ingredientId,
                                defaultAmount: next?.basisUnit === 'unit' ? 1 : row.defaultAmount || 100,
                              }
                            : row,
                        ),
                      );
                    }}
                  >
                    <option value="" disabled>
                      Select ingredient
                    </option>
                    {ingredients.map((ingredientOption) => (
                      <option key={ingredientOption.id} value={ingredientOption.id}>
                        {ingredientOption.name}
                      </option>
                    ))}
                  </TextSelect>
                  <TextInput
                    type="number"
                    min={0.001}
                    step="any"
                    required
                    value={item.defaultAmount}
                    onChange={(event) =>
                      setItems((prev) =>
                        prev.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, defaultAmount: Number(event.target.value) }
                            : row,
                        ),
                      )
                    }
                    aria-label="Default amount"
                  />
                  <div className="flex items-center justify-between gap-2 text-xs text-ink-soft sm:justify-end">
                    <span>{ingredient ? ingredient.basisUnit : ''}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={items.length <= 1}
                      onClick={() => setItems((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-leaf-soft bg-leaf-soft/40 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-leaf">
              Live totals
            </p>
            <NutritionSummary nutrition={liveNutrition} compact />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
