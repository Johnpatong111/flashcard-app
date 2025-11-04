'use client';

import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react'; 
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Utwórz klienta Supabase
const supabase = createClientComponentClient();

// Ustawienia początkowe SRS
const INITIAL_INTERVAL = 1; // Pierwsza powtórka po 1 dniu

// 💡 ZMIANA: Akceptujemy 'currentUserId' jako propsa
export default function AddFlashcardForm({ onSuccess, currentUserId }) { 
    const [stronaA, setStronaA] = useState('');
    const [stronaB, setStronaB] = useState('');
    const [category, setCategory] = useState('Podstawowe Słownictwo');
    const [jezyk, setJezyk] = useState('Angielski');
    const [przyklad, setPrzyklad] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // 🛠️ FUNKCJA POMOCNICZA: Formatowanie daty na ISO Date String (np. "2025-11-04")
    const getTodayDateString = () => {
        const today = new Date();
        // Używamy formatu ISO, ale tylko daty (YYYY-MM-DD)
        return today.toISOString().split('T')[0];
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // 💡 Zabezpieczenie przed brakiem ID użytkownika
        if (!currentUserId) {
            setError('Błąd: Brak zalogowanego użytkownika. Zaloguj się, aby dodać fiszkę.');
            return;
        }

        if (!stronaA.trim() || !stronaB.trim()) {
            setError('Obie strony (A i B) muszą być wypełnione.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // --- 1. DODAJ TREŚĆ KARTY DO TABELI 'cards' ---
            // Używamy .select().single() aby uzyskać ID wstawionego wiersza
            const { data: cardData, error: cardError } = await supabase
                .from('cards')
                .insert([
                    {
                        strona_a: stronaA.trim(),
                        strona_b: stronaB.trim(),
                        category: category.trim(),
                        jezyk: jezyk.trim(),
                        przyklad: przyklad.trim() || null,
                    }
                ])
                .select('id') // Wybieramy tylko ID
                .single();
            
            if (cardError) {
                console.error('Błąd podczas wstawiania karty:', cardError);
                throw new Error('Nie udało się dodać treści karty.');
            }
            
            const newCardId = cardData?.id; 
            if (!newCardId) {
                throw new Error('Błąd: Wstawienie karty nie zwróciło ID.');
            }


            // --- 2. DODAJ REKORD POSTĘPU DO TABELI 'user_cards' ---
            const todayDateString = getTodayDateString(); // 💡 UŻYJ FUNKCJI POMOCNICZEJ
            
            const { error: userCardError } = await supabase
                .from('user_cards')
                .insert([
                    {
                        user_id: currentUserId,           
                        card_id: newCardId,               
                        repetition_interval: INITIAL_INTERVAL, 
                        // Karta jest gotowa do powtórki dziś
                        next_review_date: todayDateString,          
                        is_mastered: false,
                        // Domyślne wartości dla SRS, np.: 
                        // easiness_factor: 2.5,
                        // repetitions: 0, 
                        // Jeśli używasz bardziej złożonego algorytmu.
                    }
                ]);

            if (userCardError) {
                console.error('Błąd podczas wstawiania postępu użytkownika:', userCardError);
                // 🚨 W realnej aplikacji przydałaby się tu transakcja,
                // aby usunąć kartę z 'cards' jeśli tu nastąpi błąd.
                throw new Error('Nie udało się zapisać postępu dla użytkownika. Sprawdź ustawienia RLS.');
            }

            // Sukces: Wyczyść formularz i odśwież talie
            setStronaA('');
            setStronaB('');
            setPrzyklad('');
            if (onSuccess) {
                onSuccess();
            }

        } catch (err) {
            setError(err.message || 'Wystąpił nieznany błąd podczas dodawania fiszki.');
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div id="add-card" className="w-full mt-10 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Plus className="w-5 h-5 mr-2 text-indigo-600" /> Dodaj Nową Fiszkę
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Selektory Kategorii i Języka */}
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700">Kategoria</label>
                        <select
                            id="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                            <option>Podstawowe Słownictwo</option>
                            <option>Gramatyka</option>
                            <option>Częste Zwroty</option>
                            <option>IT</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label htmlFor="jezyk" className="block text-sm font-medium text-gray-700">Język docelowy</label>
                        <select
                            id="jezyk"
                            value={jezyk}
                            onChange={(e) => setJezyk(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                            <option>Angielski</option>
                            <option>Hiszpański</option>
                            <option>Niemiecki</option>
                        </select>
                    </div>
                </div>

                {/* Strona A i B */}
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label htmlFor="stronaA" className="block text-sm font-medium text-gray-700">Strona A (Np. Polskie słowo/zwrot/idiom)</label>
                        <input
                            type="text"
                            id="stronaA"
                            value={stronaA}
                            onChange={(e) => setStronaA(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="Wpisz treść na stronę A..."
                            required
                        />
                    </div>
                    <div className="flex-1">
                        <label htmlFor="stronaB" className="block text-sm font-medium text-gray-700">Strona B (Odpowiednik w języku docelowym)</label>
                        <input
                            type="text"
                            id="stronaB"
                            value={stronaB}
                            onChange={(e) => setStronaB(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="Wpisz treść na stronę B..."
                            required
                        />
                    </div>
                </div>
                
                {/* Przykład użycia */}
                <div>
                    <label htmlFor="przyklad" className="block text-sm font-medium text-gray-700">Przykład użycia (opcjonalnie)</label>
                    <textarea
                        id="przyklad"
                        rows="2"
                        value={przyklad}
                        onChange={(e) => setPrzyklad(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Np. zdanie, w którym użyte jest to słowo."
                    ></textarea>
                </div>

                {/* Komunikat o błędzie */}
                {error && (
                    <div className="p-3 text-sm text-red-800 bg-red-100 rounded-md">
                        {error}
                    </div>
                )}
                
                {/* Przycisk Dodaj */}
                <button
                    type="submit"
                    disabled={isLoading || !currentUserId}
                    className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                        <Plus className="w-5 h-5 mr-2" />
                    )}
                    {isLoading ? 'Dodawanie...' : 'Dodaj Fiszkę'}
                </button>
            </form>
        </div>
    );
}