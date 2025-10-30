// src/components/AddFlashcardForm.jsx
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
// 1. IMPORT KLIENTA SUPABASE
import { supabase } from '@/utils/supabaseClient'; 

// ZMIANA: Usunięto { onAdd } z propsów
export default function AddFlashcardForm() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const handleSubmit = async (e) => { // DODANO: async
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      alert('Wprowadź pytanie i odpowiedź.');
      return;
    }
    
    // 2. WBUDOWANA LOGIKA ZAPISU DO SUPABASE
    const { data, error } = await supabase
        .from('cards') // Nazwa Twojej tabeli
        .insert([
            { 
                strona_a: question, // 'Słowo'
                strona_b: answer,   // 'Tłumaczenie'
                // opcjonalnie: język: 'Hiszpański'
            }
        ]);

    if (error) {
        console.error('BŁĄD ZAPISU DO SUPABASE:', error);
        // TUTAJ WYSKAKUJE BŁĄD 403 FORBIDDEN, JEŚLI RLS JEST BLOKOWANE
        alert('❌ Błąd zapisu na Vercel! Sprawdź błędy w konsoli przeglądarki i RLS.');
        return;
    }
    
    // Sukces!
    console.log('Fiszka pomyślnie dodana:', data);
    
    // Resetowanie pól formularza
    setQuestion('');
    setAnswer('');
  };

  return (
    <div className="w-full max-w-lg mt-12 p-6 bg-white border border-gray-200 rounded-xl shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-black">Dodaj Nową Fiszkę</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Słowo */}
        <div>
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
            placeholder="Słowo po Polsku"
          />
        </div>

        {/* Tłumaczenie */}
        <div>
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