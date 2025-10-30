// src/components/AddFlashcardForm.jsx
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

export default function AddFlashcardForm({ onAdd }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      alert('Wprowadź pytanie i odpowiedź.');
      return;
    }
    
    // Wywołanie funkcji z DeckManager, która zapisuje do Supabase
    onAdd(question, answer); 
    
    // Resetowanie pól formularza
    setQuestion('');
    setAnswer('');
  };

  return (
    <div className="w-full max-w-lg mt-12 p-6 bg-white border border-gray-200 rounded-xl shadow-lg">
      {/* Nagłówek - POPRAWA: zmieniono text-black-900 na poprawny text-black */}
      <h2 className="text-xl font-semibold mb-4 text-black">Dodaj Nową Fiszkę</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Słowo */}
        <div>
          {/* Etykieta Słowo - POPRAWA: zmieniono text-black-900 na poprawny text-black */}
          <label htmlFor="question" className="block text-sm font-medium text-black mb-1">
            Słowo
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows="2"
            required
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 resize-none text-black" 
            /* DODANO: text-black, aby wpisywany tekst był czarny */
            placeholder="Słowo po Polsku"
          />
        </div>

        {/* Tłumaczenie */}
        <div>
          {/* Etykieta Tłumaczenie - POPRAWA: zmieniono text-black-900 na poprawny text-black */}
          <label htmlFor="answer" className="block text-sm font-medium text-black mb-1">
            Tłumaczenie
          </label>
          <textarea
            id="answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows="2"
            required
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 resize-none text-black"
            /* DODANO: text-black, aby wpisywany tekst był czarny */
            placeholder="Znaczenie Słowa po Hiszpańsku"
          />
        </div>

        {/* Przycisk Dodaj */}
        <button
          type="submit"
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
        >
          <Plus className="w-5 h-5 mr-2" />
          Dodaj Fiszkę do Talii
        </button>
      </form>
    </div>
  );
}