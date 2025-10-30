// src/components/AddFlashcardForm.jsx
'use client';

import { useState } from 'react';
import { Plus, ListPlus } from 'lucide-react';
import { supabase } from '@/utils/supabaseClient'; 

export default function AddFlashcardForm({ onSuccess }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [bulkText, setBulkText] = useState(''); 
  const [isBulkMode, setIsBulkMode] = useState(false); 
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    let cardsToValidate = []; // Lista do walidacji przed zapisem
    let originalCount = 0;
    let errorCount = 0;
    
    // 1. Przygotowanie danych do walidacji
    if (isBulkMode) {
        // --- LOGIKA DLA TRYBU MASOWEGO (PRZYGOTOWANIE) ---
        if (!bulkText.trim()) {
            alert('Wprowadź fiszki do pola masowego.');
            setIsLoading(false);
            return;
        }

        const lines = bulkText.trim().split('\n');
        originalCount = lines.length;
        
        lines.forEach((line) => {
            const parts = line.split(',');
            // Sprawdzamy, czy są co najmniej dwie części i nie są puste
            if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
                cardsToValidate.push({
                    strona_a: parts[0].trim(),
                    strona_b: parts[1].trim(),
                });
            } else {
                errorCount++;
            }
        });

        if (cardsToValidate.length === 0) {
            alert('Nie wykryto żadnych poprawnych fiszek. Użyj formatu: słowo, tłumaczenie');
            setIsLoading(false);
            return;
        }

    } else {
        // --- LOGIKA DLA TRYBU POJEDYNCZEGO (PRZYGOTOWANIE) ---
        if (!question.trim() || !answer.trim()) {
            alert('Wprowadź pytanie i odpowiedź.');
            setIsLoading(false);
            return;
        }
        originalCount = 1;
        cardsToValidate.push({
            strona_a: question.trim(), 
            strona_b: answer.trim(),  
        });
    }
    
    // 2. Walidacja unikalności w bazie danych (zapytanie SELECT)
    
    // Tworzymy listę słów do sprawdzenia
    const wordsToCheck = cardsToValidate.map(card => card.strona_a);
    
    // Pobieramy z bazy tylko te słowa, które już istnieją
    const { data: existingData, error: checkError } = await supabase
      .from('cards')
      .select('strona_a')
      // Używamy .in() dla szybkiego sprawdzenia wielu wartości
      .in('strona_a', wordsToCheck);

    if (checkError) {
        console.error('BŁĄD SPRAWDZANIA DUPLIKATÓW:', checkError);
        alert('❌ Wystąpił błąd podczas sprawdzania duplikatów. Sprawdź konsolę.');
        setIsLoading(false);
        return;
    }
    
    let cardsToInsert = [];
    let existingWordsCount = 0;
    
    if (existingData) {
      // Tworzymy zbiór (Set) istniejących słów dla szybkiego wyszukiwania (niewrażliwe na wielkość liter)
      const existingSet = new Set(existingData.map(item => item.strona_a.toLowerCase()));
      
      cardsToInsert = cardsToValidate.filter(card => {
          // Sprawdzamy, czy słowo (po konwersji na małe litery) jest już w zbiorze
          if (existingSet.has(card.strona_a.toLowerCase())) {
              existingWordsCount++;
              return false; // Filtruj duplikat
          }
          return true; // Dodaj unikalne
      });
    } else {
      // Jeśli nie ma danych, wszystkie są unikalne
      cardsToInsert = cardsToValidate;
    }

    if (cardsToInsert.length === 0) {
        const message = existingWordsCount > 0 
          ? `Wszystkie (${originalCount}) fiszki już istnieją w talii!`
          : 'Brak poprawnych fiszek do dodania.';
        alert(`⛔ Walidacja: ${message}`);
        setIsLoading(false);
        return;
    }

    // 3. Zapis unikalnych fiszek do Supabase
    const { error } = await supabase
        .from('cards') 
        .insert(cardsToInsert); 

    if (error) {
        console.error('BŁĄD ZAPISU DO SUPABASE:', error);
        alert(`❌ Błąd zapisu (${cardsToInsert.length} fiszek). Sprawdź błędy w konsoli przeglądarki.`);
        setIsLoading(false);
        return;
    }
    
    // 4. Sukces i informacja dla użytkownika
    const uniqueCount = cardsToInsert.length;
    const skippedCount = originalCount - uniqueCount;
    let finalMessage = `${uniqueCount} fiszek pomyślnie dodano do talii!`;

    if (skippedCount > 0) {
      finalMessage += ` ${skippedCount} zostało pominiętych, ponieważ słowa już istnieją.`;
    }
    
    alert(`✅ Sukces! ${finalMessage}`);

    // Wywołanie callbacka
    if (onSuccess) {
        onSuccess();
    }
    
    // Resetowanie pól formularza
    setQuestion('');
    setAnswer('');
    setBulkText('');
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-lg mt-12 p-6 bg-white border border-gray-200 rounded-xl shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-black flex justify-between items-center">
        Dodaj Fiszkę
        {/* Przełącznik trybu */}
        <button
            type="button"
            onClick={() => {
                setIsBulkMode(!isBulkMode);
            }}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center transition"
        >
            {isBulkMode ? 
                <> <Plus className="w-4 h-4 mr-1" /> Tryb Pojedynczy </>
                : 
                <> <ListPlus className="w-4 h-4 mr-1" /> Tryb Masowy </>
            }
        </button>
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* 🟢 TRYB MASOWY */}
        {isBulkMode ? (
            <div>
                <label htmlFor="bulkText" className="block text-sm font-medium text-black mb-1">
                    Masowe Wprowadzanie (jedna linia = jedna fiszka)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                    Format: **słowo, tłumaczenie**
                </p>
                <textarea
                    id="bulkText"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows="8"
                    required
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 resize-none text-black font-mono text-sm" 
                    placeholder="Wpisz tutaj swoje fiszki, oddzielając słowo od tłumaczenia przecinkiem.&#10;np. Pies, Dog&#10;Kot, Cat&#10;Książka, Book"
                />
            </div>
        ) : (
            // 🟡 TRYB POJEDYNCZY
            <>
                {/* Słowo */}
                <div>
                    <label htmlFor="question" className="block text-sm font-medium text-black mb-1">
                        Słowo (Strona A)
                    </label>
                    <textarea
                        id="question"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        rows="2"
                        required
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 resize-none text-black" 
                        placeholder="Słowo/Fraz po Polsku"
                    />
                </div>

                {/* Tłumaczenie */}
                <div>
                    <label htmlFor="answer" className="block text-sm font-medium text-black mb-1">
                        Tłumaczenie (Strona B)
                    </label>
                    <textarea
                        id="answer"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        rows="2"
                        required
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 resize-none text-black"
                        placeholder="Znaczenie Słowa/Frazy (np. po Hiszpańsku)"
                    />
                </div>

                {/* USUNIĘTO CAŁY BLOK PRZYKŁADU UŻYCIA */}
            </>
        )}

        {/* Przycisk Dodaj */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 disabled:bg-indigo-400"
        >
          {isLoading ? (
                <> <ListPlus className="w-5 h-5 mr-2 animate-spin" /> Dodawanie fiszek... </>
            ) : (
                <> <ListPlus className="w-5 h-5 mr-2" /> Dodaj {isBulkMode ? 'Fiszki do Talii' : 'Fiszkę do Talii'} </>
            )}
        </button>
      </form>
    </div>
  );
}