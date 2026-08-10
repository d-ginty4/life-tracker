import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DiaryPage } from './pages/DiaryPage';
import { IngredientsPage } from './pages/IngredientsPage';
import { MealsPage } from './pages/MealsPage';
import { WeightPage } from './pages/WeightPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DiaryPage />} />
          <Route path="diary" element={<Navigate to="/" replace />} />
          <Route path="diary/:date" element={<DiaryPage />} />
          <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="meals" element={<MealsPage />} />
          <Route path="weight" element={<WeightPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
