// src/app/page.tsx (lub page.jsx)
import DeckManager from '../components/DeckManager';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8 sm:p-24 bg-gray-50">
      <h1 className="text-4xl font-extrabold mb-12 text-gray-800 text-center">
        Flashcards by Hubert
      </h1>
      
      {/* Tylko ten komponent ma renderować zawartość */}
      <DeckManager />
      
    </main>
  );
}