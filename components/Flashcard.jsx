// src/components/Flashcard.jsx
'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

// 🚨 Upewnij się, że ten komponent akceptuje onSetMastered
export default function Flashcard({ card, onDelete, onSetMastered }) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleDelete = (e) => {
    e.stopPropagation(); 
    if (confirm('Czy na pewno chcesz usunąć tę fiszkę?')) {
        onDelete(card.id);
    }
  };

  if (!card) return null;

  return (
    <div 
      className={`relative w-full max-w-lg h-64 mx-auto cursor-pointer 
                  rounded-xl shadow-2xl transition-transform duration-500 
                  transform-style-preserve-3d ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
      onClick={handleFlip}
    >
      
      {/* Front Karty (STRONA A) */}
      <div className="absolute w-full h-full backface-hidden bg-white p-6 border-4 border-indigo-600 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-light text-gray-500 mb-2">Słowo/Fraza po Polsku</p>
          <p className="text-2xl font-bold text-gray-900">{card.strona_a || "Brak słowa polskiego"}</p>
        </div>
        
        {/* Przycisk Usuń */}
        <button 
          onClick={handleDelete}
          className="absolute top-4 right-4 text-red-500 hover:text-red-700 transition"
          aria-label="Usuń fiszkę"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
      
      {/* Tył Karty (STRONA B) */}
      <div 
        className="absolute w-full h-full backface-hidden [transform:rotateY(180deg)] 
                   bg-indigo-600 p-6 border-4 border-indigo-900 rounded-xl flex items-center justify-center"
      >
        <div className="text-center">
          <p className="text-sm font-light opacity-80 mb-2 text-white">Tłumaczenie</p>
          <p className="text-2xl font-bold text-gray-900">{card.strona_b || "Brak tłumaczenia"}</p>
        </div>
      </div>
    </div>
  );
}