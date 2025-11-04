'use client'; 

import { useState, useEffect, useMemo, useCallback } from 'react';
import Flashcard from './Flashcard';
import AddFlashcardForm from './AddFlashcardForm'; 
import { ChevronLeft, ChevronRight, BookOpen, Loader2, Shuffle, Zap, Sun, Award, List, Keyboard } from 'lucide-react'; 
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';


// --- KONFIGURACJA ---
const supabase = createClientComponentClient(); 

// --- LOGIKA SRS ---

// Funkcja pomocnicza: Oblicza datę powtórki
const calculateNextReviewDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]; // Format 'YYYY-MM-DD'
};

// Algorytm Fishera-Yatesa
const shuffleArray = (array) => {
    let currentIndex = array.length, randomIndex;
    const newArray = [...array]; 
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [newArray[currentIndex], newArray[randomIndex]] = [
            newArray[randomIndex], newArray[currentIndex]];
    }
    return newArray; 
};

const INITIAL_INTERVALS = [1, 3, 7, 15, 30, 90, 180];

// --- KOMPONENT ---
// 💡 ZMIANA A: Akceptujemy currentUserId jako props!
export default function DeckManager({ currentUserId }) { 
    const [cards, setCards] = useState([]); 
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [showOnlyDue, setShowOnlyDue] = useState(true); 
    const [selectedCategory, setSelectedCategory] = useState('Wszystkie'); 
    const [displayCards, setDisplayCards] = useState([]); 
    const [testMode, setTestMode] = useState('review'); 
    
    // 💡 ZMIANA B: Usunięto stan currentUserId (jest w propsach)
    // 💡 ZMIANA C: Usunięto cały efekt useEffect do autoryzacji.


    // --- LOGIKA BAZY DANYCH ---

    // Pobieranie Danych
    const fetchCards = useCallback(async () => {
        // Zabezpieczenie: jeśli ID użytkownika nie jest dostępne (app/page.jsx nie powinno do tego dopuścić)
        if (!currentUserId) {
            setIsLoading(false);
            return; 
        }
            
        setIsLoading(true);
        
        // POBIERAMY DANE POSTĘPU ORAZ TREŚĆ KARTY
        const { data, error } = await supabase
            .from('user_cards')
            .select(`
                id,
                repetition_interval,
                next_review_date,
                is_mastered,
                cards (id, strona_a, strona_b, jezyk, category, przyklad) 
            `) 
            .eq('user_id', currentUserId)
            .order('id', { ascending: false });

        if (error) {
            console.error('BŁĄD SUPABASE: Nie udało się załadować fiszek.', error);
        } else {
            // SPŁASZCZANIE DANYCH
            const flatCards = data
                .filter(progress => progress.cards !== null) // Filtrujemy, gdyby karta bazowa została usunięta
                .map(progress => ({
                    // Dane postępu
                    repetition_interval: progress.repetition_interval,
                    next_review_date: progress.next_review_date,
                    is_mastered: progress.is_mastered,
                    user_cards_id: progress.id, // ID rekordu postępu do aktualizacji SRS
                    
                    // Treść karty
                    id: progress.cards.id, // ID właściwej fiszki
                    strona_a: progress.cards.strona_a,
                    strona_b: progress.cards.strona_b,
                    jezyk: progress.cards.jezyk,
                    category: progress.cards.category,
                    przyklad: progress.cards.przyklad,
                }));
            
            setCards(flatCards);
        }
        setIsLoading(false);
    }, [currentUserId]); // Zależność od ID użytkownika (kluczowa zmiana!)

    // Oddzielny efekt do ładowania danych, który reaguje na currentUserId
    useEffect(() => {
        if (currentUserId) {
            fetchCards();
        }
    }, [currentUserId, fetchCards]);


    // Logika REALTIME
    useEffect(() => {
        if (!supabase || !currentUserId) return;

        // Subskrypcja na zmiany w user_cards (dla postępu)
        const userCardsChannel = supabase
            .channel(`user_progress_${currentUserId}`) 
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_cards', filter: `user_id=eq.${currentUserId}` },
                () => {
                    fetchCards(); 
                }
            )
            .subscribe();

        // Subskrypcja na zmiany w cards (gdy admin/AddFlashcardForm doda nową kartę)
        const cardsChannel = supabase
            .channel('public_cards_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cards' },
                () => {
                    // Ponieważ AddFlashcardForm dodaje rekordy do cards i user_cards,
                    // wystarczy, że upewnimy się, że zmiany w user_cards wywołają fetchCards.
                    // Subskrypcja userCardsChannel już to robi!
                    // Możemy usunąć tę subskrypcję, jeśli zaufamy AddFlashcardForm
                    // Na razie zostawmy ten kod, który był:
                    setTimeout(() => fetchCards(), 500); 
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(userCardsChannel);
            supabase.removeChannel(cardsChannel);
        };
    }, [fetchCards, currentUserId]); 


    // CALLBACK dla AddFlashcardForm
    const handleSuccessCallback = useCallback(() => {
        fetchCards();
    }, [fetchCards]);

    
    // USUWANIE KARTY: Teraz usuwamy rekord z user_cards (dane postępu) i cards (treść)
    const handleDeleteCard = async (cardIdToDelete) => {
        if (!supabase || !currentUserId) return; 
        
        if (!confirm('Czy na pewno chcesz usunąć tę kartę? Spowoduje to usunięcie z Twojego postępu oraz globalnej bazy kart!')) return;
        
        try {
            // 1. Usuń rekord postępu użytkownika (user_cards)
            const { error: userCardsError } = await supabase
                .from('user_cards')
                .delete()
                .eq('card_id', cardIdToDelete)
                .eq('user_id', currentUserId);

            if (userCardsError) {
                throw new Error('Błąd usuwania z user_cards: ' + userCardsError.message);
            }

            // 2. Usuń kartę (cards)
            const { error: cardsError } = await supabase
                .from('cards')
                .delete()
                .eq('id', cardIdToDelete);

            if (cardsError) {
                throw new Error('Błąd usuwania z cards: ' + cardsError.message);
            }
            
            // 3. Usuń lokalnie i odśwież widok
            setCards(prevCards => prevCards.filter(card => card.id !== cardIdToDelete));
        } catch (error) {
            console.error('Błąd podczas usuwania fiszki:', error);
        }
    };

    // Logika useMemo... (bez zmian)
    const uniqueCategories = useMemo(() => {
        const categories = new Set(cards
            .map(card => card.category)
            .filter(category => category) 
            .map(category => category.trim()) 
        );
        return ['Wszystkie', ...Array.from(categories)];
    }, [cards]);

    const filteredBaseCards = useMemo(() => {
        let tempCards = cards;

        // 1. Filtr DATY POWTÓRKI (SRS)
        if (showOnlyDue) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayTimestamp = todayStart.getTime(); 
            
            tempCards = tempCards.filter(card => {
                if (!card.next_review_date) return true;
                
                const cardDate = new Date(card.next_review_date);
                cardDate.setHours(0, 0, 0, 0); 
                const cardReviewTimestamp = cardDate.getTime();
                
                return cardReviewTimestamp <= todayTimestamp;
            });
        } 

        // 2. Filtr kategorii
        if (selectedCategory !== 'Wszystkie') {
            const normCategory = selectedCategory.toLowerCase().trim();
            tempCards = tempCards.filter(card => 
                card.category && card.category.toLowerCase().trim() === normCategory
            );
        }

        return tempCards;
    }, [cards, showOnlyDue, selectedCategory]);

    
    useEffect(() => {
        setDisplayCards(filteredBaseCards); 
        setCurrentIndex(0);
    }, [filteredBaseCards, testMode]); 

    const isDeckEmpty = useMemo(() => displayCards.length === 0, [displayCards.length]);
    const currentCard = isDeckEmpty ? null : displayCards[currentIndex];

    // Logika handleReview (bez zmian)
    const handleReview = async (cardId, quality) => {
        if (!supabase || !currentCard || !currentCard.user_cards_id) return; 

        const currentInterval = currentCard.repetition_interval || 0;
        let newInterval = 0;
        let isMastered = false;
        
        // Logika SRS
        if (quality === 'hard') {
            newInterval = INITIAL_INTERVALS[0]; 
        } else if (quality === 'medium') {
            const currentIntervalIndex = INITIAL_INTERVALS.indexOf(currentInterval);
            const nextIndex = currentIntervalIndex >= 0 ? currentIntervalIndex + 1 : 1; 
            newInterval = INITIAL_INTERVALS[nextIndex] || INITIAL_INTERVALS[INITIAL_INTERVALS.length - 1];
        } else if (quality === 'easy') {
            const currentIntervalIndex = INITIAL_INTERVALS.indexOf(currentInterval);
            const nextIndex = currentIntervalIndex >= 0 ? currentIntervalIndex + 2 : 2;
            newInterval = INITIAL_INTERVALS[nextIndex] || INITIAL_INTERVALS[INITIAL_INTERVALS.length - 1];
            isMastered = newInterval >= 30; 
        } else {
            newInterval = INITIAL_INTERVALS[0]; 
        }

        const newReviewDate = calculateNextReviewDate(newInterval);
        
        // 1. Zapis do bazy danych: Aktualizujemy user_cards używając user_cards_id
        const { error } = await supabase
            .from('user_cards')
            .update({ 
                is_mastered: isMastered,
                repetition_interval: newInterval,
                next_review_date: newReviewDate
            })
            .eq('id', currentCard.user_cards_id); 

        if (error) {
            console.error('Błąd podczas aktualizacji statusu SRS:', error);
            return;
        }

        // 2. Natychmiastowa aktualizacja stanu lokalnego
        setCards(prevCards => prevCards.map(card => {
            if (card.user_cards_id === currentCard.user_cards_id) {
                return {
                    ...card,
                    is_mastered: isMastered,
                    repetition_interval: newInterval,
                    next_review_date: newReviewDate,
                };
            }
            return card;
        }));
        
        // 3. Płynne przejście do następnej karty
        const newDisplayCards = displayCards.filter(card => card.user_cards_id !== currentCard.user_cards_id);

        if (newDisplayCards.length > 0) {
            const nextIndex = currentIndex % newDisplayCards.length;
            setDisplayCards(newDisplayCards);
            setCurrentIndex(nextIndex);
        } else {
             // Jeśli talia jest pusta, resetujemy i czekamy na przefiltrowanie z useMemo
             setDisplayCards([]);
             setCurrentIndex(0);
        }
    };


    // PRZEWIJANIE i LOSOWANIE (bez zmian)
    const handleNext = () => {
        if (isDeckEmpty) return;
        setCurrentIndex((prevIndex) => (prevIndex + 1) % displayCards.length);
    };

    const handlePrev = () => {
        if (isDeckEmpty) return;
        setCurrentIndex((prevIndex) => (prevIndex - 1 + displayCards.length) % displayCards.length);
    };
    
    const handleShuffle = () => {
        if (filteredBaseCards.length === 0) return;
        
        const shuffled = shuffleArray(filteredBaseCards); 
        setDisplayCards(shuffled); 
        setCurrentIndex(0); 
    };


    // Warunki renderowania
    
    // 💡 ZMIANA D: Uproszczona obsługa ładowania (zakładamy, że user ID jest przekazane)
    if (isLoading) {
        // Użytkownik zalogowany, ale dane się ładują
          return (
            <div className="flex justify-center items-center h-64 w-full max-w-2xl mt-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
                <p className="text-xl text-gray-700">Ładowanie fiszek z Supabase...</p>
            </div>
        );
    }
    
    const dueCount = filteredBaseCards.length; 
    
    return (
        <div className="flex flex-col items-center w-full max-w-2xl p-4">

            {/* Panel Filtrów */}
            <div 
                className="flex flex-wrap justify-center gap-4 mb-4 p-4 bg-white rounded-lg shadow-md w-full">
                
                {/* 1. Przełącznik "Pokaż tylko gotowe do powtórki" */}
                <button
                    onClick={() => {
                        setShowOnlyDue(!showOnlyDue);
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-full transition ${
                        showOnlyDue 
                        ? 'bg-indigo-500 text-white hover:bg-indigo-600' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    {showOnlyDue ? `🧠 Tryb Powtórek (${dueCount})` : '📚 Pokaż Wszystkie Karty'}
                </button>
                
                {/* 2. SELECT DLA KATEGORII */}
                <select
                    value={selectedCategory}
                    onChange={(e) => {
                        setSelectedCategory(e.target.value);
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-full border border-gray-300 bg-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                    {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>
                            {cat === 'Wszystkie' ? 'Wszystkie Kategorie' : cat}
                        </option>
                    ))}
                </select>
                
                {/* 3. Przełącznik Trybu Testu */}
                <div className="flex space-x-2 p-1 bg-gray-100 rounded-lg">
                    <button
                        onClick={() => setTestMode('review')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition ${testMode === 'review' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}
                        title="Tryb Przeglądu (kliknij, aby odsłonić)"
                    >
                        <List className="w-4 h-4 inline-block mr-1" /> Przegląd
                    </button>
                    <button
                        onClick={() => setTestMode('typing')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition ${testMode === 'typing' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}
                        title="Tryb Pisania (wpisz odpowiedź)"
                    >
                        <Keyboard className="w-4 h-4 inline-block mr-1" /> Pisanie
                    </button>
                </div>

            </div>
            
            <div className="w-full">
                {isDeckEmpty ? (
                    <div className="w-full max-w-lg h-64 mx-auto p-6 flex flex-col items-center justify-center bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-300 shadow-inner">
                        <BookOpen className="w-8 h-8 mb-3" />
                        <p className="font-semibold text-center">
                            {
                              showOnlyDue 
                              ? 'Świetna robota! Wszystkie karty do powtórki zostały ukończone.'
                              : 'Talia do powtórki jest pusta. Spróbuj zmienić filtry!'
                            }
                          </p>
                            {selectedCategory !== 'Wszystkie' && <p className='mt-2 text-sm'>Spróbuj zmienić kategorię!</p>}
                    </div>
                ) : (
                    <>
                        <p className="mb-4 text-sm font-medium text-gray-500 text-center">
                            Słówko **{currentIndex + 1}** z **{displayCards.length}** {currentCard.is_mastered && <span className="ml-2 text-green-500 font-bold">(Opanowane)</span>}
                            {currentCard.category && 
                                <span className="ml-2 text-blue-500 font-medium text-xs bg-blue-100 px-2 py-1 rounded-full">
                                    Kategoria: {currentCard.category}
                                </span>
                            }
                        </p>
                        
                        {/* 1. RENDEROWANIE FISZKI */}
                        <Flashcard 
                            card={currentCard} 
                            onDelete={handleDeleteCard} 
                            onReview={(quality) => handleReview(currentCard.id, quality)}
                            testMode={testMode} 
                        />
                        
                        {/* 🚨 Przyciski Oceny SRS (Tylko w trybie przeglądu) */}
                        {testMode === 'review' && (
                            <div className="flex justify-center gap-4 w-full max-w-lg mx-auto mt-4">
                                <button
                                    onClick={() => handleReview(currentCard.id, 'hard')}
                                    className="flex items-center px-4 py-3 bg-red-500 text-white rounded-lg font-semibold transition hover:bg-red-600"
                                >
                                    <Zap className="w-5 h-5 mr-2" />
                                    Trudne (1 dzień)
                                </button>
                                <button
                                    onClick={() => handleReview(currentCard.id, 'medium')}
                                    className="flex items-center px-4 py-3 bg-yellow-500 text-white rounded-lg font-semibold transition hover:bg-yellow-600"
                                >
                                    <Sun className="w-5 h-5 mr-2" />
                                    Pamiętam
                                </button>
                                <button
                                    onClick={() => handleReview(currentCard.id, 'easy')}
                                    className="flex items-center px-4 py-3 bg-green-500 text-white rounded-lg font-semibold transition hover:bg-green-600"
                                >
                                    <Award className="w-5 h-5 mr-2" />
                                    Łatwe
                                </button>
                            </div>
                          )}
                        
                        {/* Przyciski Nawigacji i Losowanie (bez zmian) */}
                        <div className="flex justify-between w-full max-w-lg mx-auto mt-8">
                            <button 
                                onClick={handlePrev}
                                className="flex items-center px-6 py-3 bg-gray-200 text-gray-700 rounded-full font-semibold transition hover:bg-gray-300 disabled:opacity-50"
                                disabled={displayCards.length <= 1}
                            >
                                <ChevronLeft className="w-5 h-5 mr-2" />
                                Poprzednia
                            </button>
                            
                            <button 
                                onClick={handleNext}
                                className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-full font-semibold transition hover:bg-indigo-700 disabled:opacity-50"
                                disabled={displayCards.length <= 1}
                            >
                                Następna
                                <ChevronRight className="w-5 h-5 ml-2" />
                            </button>
                        </div>

                        <div className="mt-4 text-center">
                            <button
                                onClick={handleShuffle}
                                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full text-indigo-600 border border-indigo-600 bg-white hover:bg-indigo-50 transition"
                                disabled={displayCards.length <= 1}
                            >
                                <Shuffle className="w-4 h-4 mr-2" />
                                Potasuj talię ({displayCards.length} kart)
                            </button>
                        </div>

                    </>
                )}
            </div>

            {/* Sekcja Dodawania - Używa propsa currentUserId */}
            <AddFlashcardForm onSuccess={handleSuccessCallback} currentUserId={currentUserId} /> 
        </div>
    );
}