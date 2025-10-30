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
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Dodaj Nową Fiszkę</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Słowo */}
        <div>
          <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-1">
            Słowo
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows="2"
            required
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 resize-none"
            placeholder="Np. Stolica Francji to..."
          />
        </div>

        {/* Tłumaczenie */}
        <div>
          <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-1">
            Tłumaczenie
          </label>
          <textarea
            id="answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows="2"
            required
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 resize-none"
            placeholder="Np. Paryż"
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