import {
  BASIS_UNITS,
  type BasisUnit,
  type Ingredient,
  type IngredientInput,
  type MealRef,
} from '@health-tracker/shared';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import {
  createIngredient,
  deleteIngredient,
  listIngredients,
  updateIngredient,
} from '../api/ingredients';
import { Modal } from '../components/Modal';
import { formatNutritionLine } from '../lib/format';
import { Button, EmptyState, ErrorBanner, Field, PageHeader, TextInput, TextSelect, TextTextarea } from '../components/ui';

const emptyForm: IngredientInput = {
  name: '',
  basisAmount: 100,
  basisUnit: 'g',
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  notes: null,
};

function defaultsForUnit(unit: BasisUnit): number {
  return unit === 'unit' ? 1 : 100;
}

export function IngredientsPage() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState<IngredientInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<{ id: string; meals: MealRef[] } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listIngredients();
      setItems(data.slice().sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ingredients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setEditorOpen(true);
  }

  function openEdit(ingredient: Ingredient) {
    setEditing(ingredient);
    setForm({
      name: ingredient.name,
      basisAmount: ingredient.basisAmount,
      basisUnit: ingredient.basisUnit,
      calories: ingredient.calories,
      protein: ingredient.protein,
      carbs: ingredient.carbs,
      fat: ingredient.fat,
      fiber: ingredient.fiber,
      notes: ingredient.notes,
    });
    setEditorOpen(true);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateIngredient(editing.id, form);
      } else {
        await createIngredient(form);
      }
      setEditorOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ingredient');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(ingredient: Ingredient, force = false) {
    setError(null);
    try {
      await deleteIngredient(ingredient.id, force);
      setConflict(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) {
        const details = err.details as { meals?: MealRef[] } | undefined;
        setConflict({ id: ingredient.id, meals: details?.meals ?? [] });
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to delete ingredient');
    }
  }

  return (
    <section>
      <PageHeader
        title="Ingredients"
        description="Manual nutrition library. Meals pick up edits; past diary entries keep their snapshots."
        actions={<Button onClick={openCreate}>Add ingredient</Button>}
      />
      <ErrorBanner message={error} />

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState>No ingredients yet. Add pasta, eggs, milk — whatever you cook with.</EmptyState>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((ingredient) => (
            <li
              key={ingredient.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-display text-lg font-bold text-ink">{ingredient.name}</p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  per {ingredient.basisAmount}
                  {ingredient.basisUnit === 'unit' ? ' unit' : ingredient.basisUnit} ·{' '}
                  {formatNutritionLine(ingredient)}
                </p>
                {ingredient.notes ? (
                  <p className="mt-1 text-xs text-ink-soft/80">{ingredient.notes}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => openEdit(ingredient)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => void onDelete(ingredient)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editorOpen}
        title={editing ? 'Edit ingredient' : 'New ingredient'}
        onClose={() => setEditorOpen(false)}
        wide
      >
        <form className="space-y-4" onSubmit={(event) => void onSave(event)}>
          <Field label="Name">
            <TextInput
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Basis amount">
              <TextInput
                type="number"
                min={0.001}
                step="any"
                required
                value={form.basisAmount}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, basisAmount: Number(event.target.value) }))
                }
              />
            </Field>
            <Field label="Basis unit">
              <TextSelect
                value={form.basisUnit}
                onChange={(event) => {
                  const basisUnit = event.target.value as BasisUnit;
                  setForm((prev) => ({
                    ...prev,
                    basisUnit,
                    basisAmount: defaultsForUnit(basisUnit),
                  }));
                }}
              >
                {BASIS_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </TextSelect>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ['calories', 'Calories'],
                ['protein', 'Protein (g)'],
                ['carbs', 'Carbs (g)'],
                ['fat', 'Fat (g)'],
                ['fiber', 'Fiber (g)'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <TextInput
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={form[key]}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, [key]: Number(event.target.value) }))
                  }
                />
              </Field>
            ))}
          </div>
          <Field label="Notes" hint="Optional">
            <TextTextarea
              value={form.notes ?? ''}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, notes: event.target.value || null }))
              }
            />
          </Field>
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

      <Modal
        open={conflict !== null}
        title="Ingredient is used by meals"
        onClose={() => setConflict(null)}
      >
        {conflict ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              Remove it from these meals and delete any meal left empty, or cancel.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {conflict.meals.map((meal) => (
                <li key={meal.id}>{meal.name}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConflict(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const target = items.find((item) => item.id === conflict.id);
                  if (target) void onDelete(target, true);
                }}
              >
                Force delete
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
