'use client';

import { useState, useEffect } from 'react';
// Zaimportowane wszystkie potrzebne ikony, w tym Volume2
import { Trash2, CalendarDays, Hourglass, Eye, Check, Volume2 } from 'lucide-react'; 

// ====================================================================
// 💡 FUNKCJA: TEXT-TO-SPEECH
// ====================================================================

/**
 * Czyta podany tekst za pomocą Web Speech API (wbudowane w przeglądarkę).
 */
const speakText = (textToRead, lang = 'pl-PL') => {
    if (!textToRead) return;

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Zawsze anuluj bieżący głos przed rozpoczęciem nowego

        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = lang; 
        utterance.rate = 0.9; 
        
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn('Text-to-Speech API nie jest wspierane w tej przeglądarce.');
    }
};

// ====================================================================

// Funkcja pomocnicza do formatowania daty (BEZ ZMIAN)
const formatDate = (dateString) => {
    if (!dateString) return 'Brak'; 
    try {
        const date = new Date(dateString);
        const today = new Date();
        // Sprawdzamy, czy data to dzisiaj
        if (date.toDateString() === today.toDateString()) {
            return 'Dzisiaj';
        }
        return date.toLocaleDateString('pl-PL', {
            month: 'short', 
            day: 'numeric',
        });
    } catch (e) {
        return 'Błąd daty';
    }
};

// ====================================================================
// --- FUNKCJA POMOCNICZA: Ustalanie kodu języka ---
// ====================================================================
const getLangCode = (side, card) => {
    // 1. STRONA A (Pytanie) - ZAWSZE POLSKI
    if (side === 'strona_a') {
        return 'pl-PL'; 
    }
    
    // 2. STRONA B (Odpowiedź) - Zależy od pola 'jezyk'
    const targetLanguage = card.jezyk?.toLowerCase();

    if (targetLanguage === 'angielski') {
        return 'en-US'; 
    }
    
    // Domyślnie, dla "hiszpanski" lub dowolnego innego
    return 'es-ES'; 
};
// --------------------------------------------------------------------


// Nowa lista propsów: dodano onReview i testMode
export default function Flashcard({ card, onDelete, onReview, testMode }) {
    const [isFlipped, setIsFlipped] = useState(false);
    const [isAnswerRevealed, setIsAnswerRevealed] = useState(false); 
    const [inputValue, setInputValue] = useState('');
    const [isCorrect, setIsCorrect] = useState(null); 
    
    // Efekt 1: Reset stanu przy zmianie karty lub trybu
    useEffect(() => {
        setIsFlipped(false);
        setIsAnswerRevealed(false); 
        setInputValue('');
        setIsCorrect(null);
        // ZAWSZE anuluj mowę przy zmianie karty
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }, [card.id, testMode]); 
    
    // ====================================================================
    // Efekt 2: AUTOMATYCZNE ODTWARZANIE STRONY A PRZY ZAŁADOWANIU KARTY
    // Ten efekt jest wywoływany tylko przy ładowaniu NOWEJ karty (czyli isFlipped = false)
    // ====================================================================
    useEffect(() => {
        if (!card.id) return;
        
        const isInitialLoadOrNewCard = !isFlipped && !isAnswerRevealed;
        const shouldAutoplay = isInitialLoadOrNewCard && (testMode === 'review' || testMode === 'typing');
        
        if (card.strona_a && shouldAutoplay) {
            // ZAWSZE anuluj przed rozpoczęciem
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            const langCodeA = getLangCode('strona_a', card); 
            speakText(card.strona_a, langCodeA);
        }
        
        // Czystka przy demontażu/zmianie stanu (zapobiega mówieniu po przejściu do innej karty)
        return () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };

    }, [card.id, testMode, isFlipped, isAnswerRevealed, card.strona_a]); 
    // ====================================================================


    // Przełączanie karty: działa tylko w trybie 'review'
    const handleFlip = () => {
        if (testMode === 'review') {
            
            // 1. ZAWSZE ANULUJEMY bieżącą mowę (czyli przerywamy Stronę A)
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }

            // 2. ZMIENIAMY STAN
            const nextFlippedState = !isFlipped;
            setIsFlipped(nextFlippedState);
            setIsAnswerRevealed(true); 
            
            // 3. NATYCHMIAST URUCHAMIAMY TTS DLA STRONY B
            if (!isFlipped && card.strona_b) { // Jeśli przechodzimy na stronę B (czyli isFlipped było false)
                const langCodeB = getLangCode('strona_b', card);
                speakText(card.strona_b, langCodeB);
            }
        }
    };

    const handleDelete = (e) => {
        e.stopPropagation(); 
        if (confirm('Czy na pewno chcesz usunąć tę fiszkę?')) {
            onDelete(card.id);
        }
    };
    
    // LOGIKA TRYBU PISANIA (BEZ ZMIAN)
    const handleCheckAnswer = () => {
        const correct = card.strona_b.trim().toLowerCase();
        const input = inputValue.trim().toLowerCase();

        setIsCorrect(input === correct);
        setIsAnswerRevealed(true); 
        
        // 🎙️ ODTWARZANIE PO SPRAWDZENIU W TRYBIE PISANIA
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        if (card.strona_b) {
            const langCodeB = getLangCode('strona_b', card);
            speakText(card.strona_b, langCodeB);
        }
    };

    const handleRevealAnswer = () => {
        setIsAnswerRevealed(true);
        setIsCorrect(false); 
        
        // 🎙️ ODTWARZANIE PO ODKRYCIU W TRYBIE PISANIA
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        if (card.strona_b) {
            const langCodeB = getLangCode('strona_b', card);
            speakText(card.strona_b, langCodeB);
        }
    };
    
    
    if (!card) return null;

    const nextReviewDate = card.next_review_date;
    const formattedNextReviewDate = formatDate(nextReviewDate);
    const isOverdue = nextReviewDate && new Date(nextReviewDate) < new Date();
    
    const isCardVisible = testMode === 'review' ? isFlipped : isAnswerRevealed;
    

    return (
        <div 
            className={`relative w-full max-w-lg h-64 mx-auto cursor-pointer 
                        rounded-xl shadow-2xl transition-transform duration-500 
                        transform-style-preserve-3d ${isCardVisible ? '[transform:rotateY(180deg)]' : ''}`}
            onClick={testMode === 'review' ? handleFlip : undefined}
        >
            
            {/* Front Karty (STRONA A) - Pytanie */}
            <div className="absolute w-full h-full backface-hidden bg-white p-6 border-4 border-indigo-600 rounded-xl flex flex-col items-center justify-center">
                
                {/* 💡 TREŚĆ W TRYBIE PISANIA: POKAZUJEMY TYLKO STRONĘ A */}
                {testMode === 'typing' && !isAnswerRevealed ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center w-full">
                        <p className="text-sm font-light text-gray-500 mb-2">Wpisz tłumaczenie do:</p>
                        <p className="text-3xl font-bold text-gray-900 mb-6">{card.strona_a}</p>
                        
                        <input 
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            className="w-full max-w-sm px-4 py-3 text-lg text-gray-900 rounded-lg border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Wpisz odpowiedź..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCheckAnswer();
                            }}
                        />
                        <div className="flex space-x-4 mt-4">
                            <button onClick={handleCheckAnswer} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                <Check className="w-5 h-5 mr-1" /> Sprawdź
                            </button>
                            <button onClick={handleRevealAnswer} className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                                <Eye className="w-5 h-5 mr-1" /> Odkryj
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-center">
                        <p className="text-sm font-light text-gray-500 mb-2">Słowo/Fraza (Strona A)</p>
                        <div className="relative">
                            <p className="text-2xl font-bold text-gray-900">{card.strona_a || "Brak słowa polskiego"}</p>
                            
                            {/* 🎙️ IKONA GŁOŚNIKA DLA STRONY A: Manualne odtwarzanie */}
                            {card.strona_a && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation(); 
                                        if ('speechSynthesis' in window) {
                                            window.speechSynthesis.cancel();
                                        }
                                        speakText(card.strona_a, getLangCode('strona_a', card)); 
                                    }}
                                    className="absolute top-[-10px] right-[-30px] p-1 text-gray-500 hover:text-indigo-600 transition-colors rounded-full hover:bg-gray-100"
                                    aria-label="Odtwórz pytanie głosowo"
                                >
                                    <Volume2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Wskaźnik Daty Powtórki (na dole po lewej) */}
                <div className="absolute bottom-4 left-4 flex items-center text-xs font-medium">
                    <CalendarDays className="w-3 h-3 mr-1 text-indigo-500" />
                    <span className={isOverdue ? 'font-bold text-red-500' : 'text-gray-600'}>
                        {isOverdue ? 'Zaległe: ' : 'Następna: '} {formattedNextReviewDate}
                    </span>
                </div>

                {/* Przycisk Usuń (na górze po prawej) */}
                <button 
                    onClick={handleDelete}
                    className="absolute top-4 right-4 text-red-500 hover:text-red-700 transition"
                    aria-label="Usuń fiszkę"
                >
                    <Trash2 className="w-5 h-5" />
                </button>

            </div>
            
            {/* Tył Karty (STRONA B) - Odpowiedź/Język obcy */}
            <div 
                className="absolute w-full h-full backface-hidden [transform:rotateY(180deg)] 
                            p-6 border-4 border-indigo-900 rounded-xl flex flex-col items-center justify-center"
                style={{ backgroundColor: '#1f2937', color: 'white' }} 
            >
                <div className="flex-grow flex flex-col items-center justify-center text-center w-full">
                    
                    {/* Wskaźnik poprawności w trybie pisania */}
                    {isAnswerRevealed && testMode === 'typing' && (
                        <div className="absolute top-4 w-full px-6">
                            <div className={`py-2 px-4 rounded-lg font-bold text-white ${isCorrect ? 'bg-green-600' : 'bg-red-600'}`}>
                                {isCorrect ? '✅ Poprawnie!' : '❌ Błąd. Poprawna odpowiedź to:'}
                            </div>
                        </div>
                    )}

                    <p className="text-sm font-light opacity-80 mb-2" style={{ color: 'white' }}>Tłumaczenie (Strona B)</p>
                    <div className="relative">
                        <p className="text-2xl font-bold" style={{ color: 'white' }}>{card.strona_b || "Brak tłumaczenia"}</p>
                        
                        {/* 🎙️ IKONA GŁOŚNIKA DLA STRONY B: Manualne odtwarzanie */}
                        {card.strona_b && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); 
                                    if ('speechSynthesis' in window) {
                                        window.speechSynthesis.cancel();
                                    }
                                    speakText(card.strona_b, getLangCode('strona_b', card)); // ES-ES lub EN-US
                                }}
                                className="absolute top-[-10px] right-[-30px] p-1 text-gray-400 hover:text-indigo-400 transition-colors rounded-full hover:bg-gray-700"
                                aria-label="Odtwórz tłumaczenie głosowo"
                            >
                                <Volume2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    
                    {/* Warunkowe wyświetlanie Przykładu */}
                    {card.przyklad && (
                        <div className="mt-4 p-2 w-full max-w-sm text-center bg-gray-700/50 rounded-lg">
                            <p className="text-xs font-semibold opacity-90 mb-1">Przykład użycia:</p>
                            <p className="italic text-base">"{card.przyklad}"</p>
                        </div>
                    )}
                    
                </div>
                
                {/* Wskaźnik Interwału (na dole po lewej) */}
                <div className="absolute bottom-4 left-4 flex items-center text-xs font-medium" style={{ color: 'white', opacity: 0.8 }}>
                    <Hourglass className="w-3 h-3 mr-1" style={{ color: 'white', opacity: 0.8 }} />
                    <span>
                        Interwał: **{card.repetition_interval || 0} dni**
                    </span>
                </div>
            </div>
        </div>
    );
}