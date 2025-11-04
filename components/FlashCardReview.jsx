'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Loader2, Zap } from 'lucide-react';

const supabase = createClientComponentClient();

// Stałe do obliczeń SRS (Simplistic SRS: 1, 3, 7, 14, 30...)
const SRS_INTERVALS = [1, 3, 7, 14, 30, 60, 90, 180, 365];

export default function FlashcardReview({ currentUserId }) {
    const [cards, setCards] = useState([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isFlipped, setIsFlipped] = useState(false);
    const [error, setError] = useState(null);

    // 🛠️ FUNKCJA POMOCNICZA: Oblicza nową datę recenzji
    const calculateNextReviewDate = (currentInterval, performanceRating) => {
        // Jeśli użytkownik ocenił 'Źle', interwał resetuje się lub jest minimalny
        if (performanceRating === 'bad') {
            return {
                newInterval: SRS_INTERVALS[0], // 1 dzień
                newRepetitions: 0,
            };
        }

        // Znajdź obecny interwał w tablicy
        const currentIndex = SRS_INTERVALS.indexOf(currentInterval);
        let nextIndex;

        if (performanceRating === 'good') {
            nextIndex = currentIndex < SRS_INTERVALS.length - 1 ? currentIndex + 1 : SRS_INTERVALS.length - 1;
        } else { // performanceRating === 'easy'
            // Opcjonalnie: Przeskok do przodu o 2 interwały, by nagrodzić łatwość
            nextIndex = currentIndex < SRS_INTERVALS.length - 2 ? currentIndex + 2 : SRS_INTERVALS.length - 1;
        }

        const newInterval = SRS_INTERVALS[nextIndex];
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newInterval);
        
        return {
            newInterval: newInterval,
            newDate: nextDate.toISOString().split('T')[0], // YYYY-MM-DD
        };
    };


    const fetchCardsForReview = useCallback(async () => {
        if (!currentUserId) {
            setError('Błąd: Użytkownik nie jest zalogowany.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        
        try {
            // 💡 Zapytanie łączy karty z postępem użytkownika i filtruje
            const today = new Date().toISOString().split('T')[0];

            const { data, error: fetchError } = await supabase
                .from('user_cards')
                .select(`
                    *,
                    card:cards (strona_a, strona_b, category, jezyk)
                `)
                .eq('user_id', currentUserId)
                .lte('next_review_date', today) // Filtruj: data <= dziś
                .order('next_review_date', { ascending: true }); // Najstarsze powtórki najpierw
            
            if (fetchError) throw fetchError;

            // Zapewnienie, że dane są w dobrym formacie
            setCards(data.filter(card => card.card !== null).map(card => ({
                ...card.card, // Treść z tabeli cards
                userCardId: card.id, // ID rekordu postępu (do UPDATE)
                currentInterval: card.repetition_interval,
            })));

        } catch (err) {
            console.error('Błąd ładowania kart:', err);
            setError('Nie udało się załadować fiszek do powtórki. Sprawdź RLS dla SELECT.');
        } finally {
            setIsLoading(false);
        }
    }, [currentUserId]);

    // 🚀 Funkcja aktualizująca postęp karty (Główna logika SRS)
    const handleGrade = async (performanceRating) => {
        setIsFlipped(false); // Opcjonalnie: Zapewnienie, że karta jest już odwrócona

        const currentCard = cards[currentCardIndex];
        if (!currentCard) return;

        // Oblicz nowy interwał i datę
        const { newInterval, newDate } = calculateNextReviewDate(
            currentCard.currentInterval, 
            performanceRating
        );
        
        // --- Zapytanie UPDATE do user_cards ---
        const { error: updateError } = await supabase
            .from('user_cards')
            .update({ 
                repetition_interval: newInterval,
                next_review_date: newDate,
                is_mastered: newInterval > SRS_INTERVALS[SRS_INTERVALS.length - 2], // Przykład warunku 'opanowania'
            })
            .eq('id', currentCard.userCardId) // Użyj ID rekordu user_cards, nie card_id
            .eq('user_id', currentUserId); // Podwójne zabezpieczenie RLS
        
        if (updateError) {
            console.error('Błąd aktualizacji postępu:', updateError);
            setError('Nie udało się zaktualizować postępu karty. Sprawdź RLS dla UPDATE.');
            return;
        }

        // Przejście do następnej karty
        const nextIndex = currentCardIndex + 1;
        if (nextIndex < cards.length) {
            setCurrentCardIndex(nextIndex);
            setIsFlipped(false);
        } else {
            // Wszystkie karty skończone, odświeżamy listę/wyświetlamy komunikat
            setCards([]); 
        }
    };


    useEffect(() => {
        fetchCardsForReview();
    }, [fetchCardsForReview]);


    // --- RENDEROWANIE ---
    
    // 1. Stan ładowania
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-48 bg-white rounded-xl shadow-lg border border-gray-100">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="ml-3 text-gray-600">Ładowanie fiszek...</p>
            </div>
        );
    }
    
    // 2. Stan błędu
    if (error) {
        return (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl">
                <p className="font-bold">Błąd!</p>
                <p>{error}</p>
            </div>
        );
    }

    // 3. Stan "Wszystko zrobione"
    if (cards.length === 0) {
        return (
            <div className="p-10 bg-yellow-50 rounded-xl shadow-lg border border-yellow-200 text-center">
                <span className="text-4xl">📚</span>
                <p className="mt-3 text-lg font-semibold text-yellow-800">
                    Świetna robota! Wszystkie karty do powtórki zostały ukończone.
                </p>
                <button
                    onClick={fetchCardsForReview}
                    className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                    Spróbuj odświeżyć
                </button>
            </div>
        );
    }
    
    // 4. Stan wyświetlania karty
    const currentCard = cards[currentCardIndex];
    const totalCount = cards.length;
    const remainingCount = totalCount - currentCardIndex;


    return (
        <div className="space-y-4">
            {/* Nagłówek i Postęp */}
            <div className="flex justify-between items-center text-gray-600">
                <h3 className="text-xl font-semibold flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-indigo-500"/> 
                    Tryb Powtórek
                </h3>
                <span className="text-sm font-medium">
                    Pozostało: {remainingCount} z {totalCount}
                </span>
            </div>

            {/* Karta Fiszek */}
            <div 
                className={`w-full h-64 p-8 rounded-xl shadow-xl transition-transform duration-500 transform cursor-pointer 
                    ${isFlipped ? 'bg-indigo-50 border-2 border-indigo-200' : 'bg-white border border-gray-100'}`}
                onClick={() => setIsFlipped(!isFlipped)}
            >
                <p className="text-sm font-medium text-gray-500 mb-2">
                    {isFlipped ? 'Strona B' : 'Strona A'}
                </p>
                <h4 className="text-3xl font-bold text-center mt-10">
                    {isFlipped ? currentCard.strona_b : currentCard.strona_a}
                </h4>
                {isFlipped && currentCard.przyklad && (
                    <p className="text-center text-sm text-gray-600 mt-4 italic">
                        Przykład: "{currentCard.przyklad}"
                    </p>
                )}
            </div>

            {/* Przyciski Oceny */}
            {isFlipped && (
                <div className="flex justify-between gap-3 pt-2">
                    <button
                        onClick={() => handleGrade('bad')}
                        className="flex-1 py-3 text-sm font-semibold rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors"
                    >
                        Źle (1 dzień)
                    </button>
                    <button
                        onClick={() => handleGrade('good')}
                        className="flex-1 py-3 text-sm font-semibold rounded-lg text-white bg-yellow-500 hover:bg-yellow-600 transition-colors"
                    >
                        Dobrze ({SRS_INTERVALS[SRS_INTERVALS.indexOf(currentCard.currentInterval) < SRS_INTERVALS.length - 1 ? SRS_INTERVALS.indexOf(currentCard.currentInterval) + 1 : SRS_INTERVALS.length - 1]} dni)
                    </button>
                    <button
                        onClick={() => handleGrade('easy')}
                        className="flex-1 py-3 text-sm font-semibold rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors"
                    >
                        Łatwo (Długi interwał)
                    </button>
                </div>
            )}
            
            {!isFlipped && (
                <button
                    onClick={() => setIsFlipped(true)}
                    className="w-full py-3 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                    Sprawdź odpowiedź
                </button>
            )}
        </div>
    );
}