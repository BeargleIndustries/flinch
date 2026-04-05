"""
flinch/lexical.py — Reusable lexical analysis engine.

Lazy-loads NLTK data and Brown corpus on first use.
Computes 25+ metrics per text. Keys match response_metrics DB columns exactly.
"""
from __future__ import annotations

import math
import re
import statistics
import threading
from collections import Counter

# ---------------------------------------------------------------------------
# Optional dependency flags
# ---------------------------------------------------------------------------

try:
    import textstat
    HAS_TEXTSTAT = True
except ImportError:
    HAS_TEXTSTAT = False

try:
    from textblob import TextBlob
    HAS_TEXTBLOB = True
except ImportError:
    HAS_TEXTBLOB = False

try:
    from lexical_diversity import lex_div as ld
    HAS_LEXDIV = True
except ImportError:
    HAS_LEXDIV = False

# ---------------------------------------------------------------------------
# Marker word lists
# ---------------------------------------------------------------------------

HEDGING_MARKERS = [
    "perhaps", "maybe", "possibly", "might", "could be", "may be",
    "I think", "I believe", "it seems", "it appears", "sort of",
    "kind of", "somewhat", "arguably", "in my opinion", "I'm not sure",
    "it's possible", "it's likely", "tend to", "generally speaking",
]

CONFIDENCE_MARKERS = [
    "certainly", "definitely", "absolutely", "clearly", "obviously",
    "undoubtedly", "without a doubt", "no question", "of course",
    "it is clear", "there is no doubt", "unquestionably", "inevitably",
    "always", "never", "every", "must be", "cannot be",
]

EVASION_MARKERS = [
    "it's important to note", "it's worth considering",
    "that's a great question", "I appreciate your",
    "there are many perspectives", "it really depends",
    "I understand your concern", "both sides have valid points",
    "this is a complex topic", "reasonable people disagree",
    "I'd encourage you to", "you might want to consider",
    "that said", "on balance", "it's nuanced",
    "I should point out", "for what it's worth",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def strip_markdown(text: str) -> str:
    """Remove markdown formatting for clean text analysis."""
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)   # bold
    text = re.sub(r'\*(.+?)\*', r'\1', text)         # italic
    text = re.sub(r'`{1,3}.*?`{1,3}', '', text, flags=re.DOTALL)  # code
    text = re.sub(r'#+\s*', '', text)                # headers
    text = re.sub(r'[-*]\s+', '', text)              # list markers
    text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text)  # links
    return text.strip()


def _count_markers(text_lower: str, markers: list[str]) -> int:
    return sum(1 for m in markers if m.lower() in text_lower)


# ---------------------------------------------------------------------------
# LexicalAnalyzer
# ---------------------------------------------------------------------------

class LexicalAnalyzer:
    """Full lexical analysis engine. Lazy-loads NLTK data and Brown corpus on first use.
    Computes 25+ metrics per text. Keys match response_metrics DB columns exactly."""

    MIN_WORDS = 5

    def __init__(self):
        self._brown_ranked: dict[str, int] | None = None
        self._max_rank: int = 0
        self._stopwords: set[str] = set()
        self._initialized = False
        self._init_lock = threading.Lock()

    def _ensure_init(self) -> None:
        """Lazy-load NLTK data + Brown corpus frequency table. Thread-safe."""
        if self._initialized:
            return
        with self._init_lock:
            if self._initialized:
                return

        import nltk

        for resource in ("brown", "averaged_perceptron_tagger", "punkt_tab", "stopwords"):
            nltk.download(resource, quiet=True)

        # Build Brown corpus frequency ranks: word -> rank (1 = most frequent)
        brown_words = [w.lower() for w in nltk.corpus.brown.words()]
        brown_freq = Counter(brown_words)
        self._brown_ranked = {
            word: rank
            for rank, (word, _) in enumerate(
                sorted(brown_freq.items(), key=lambda x: -x[1]), 1
            )
        }
        self._max_rank = len(self._brown_ranked)
        self._stopwords = set(nltk.corpus.stopwords.words("english"))
        self._initialized = True

    def analyze(self, text: str) -> dict:
        """Compute all lexical metrics. Returns dict with metric_name -> value.
        Keys match response_metrics DB columns exactly.
        Returns all-None dict if text is too short (< 5 words after stripping)."""
        self._ensure_init()

        import nltk

        NONE_RESULT: dict = {
            "word_count": None, "sentence_count": None, "words_per_sentence": None,
            "flesch_kincaid_grade": None, "flesch_reading_ease": None, "gunning_fog": None,
            "mtld": None, "ttr": None, "honore_statistic": None,
            "avg_word_freq_rank": None, "median_word_freq_rank": None, "oov_rate": None,
            "modal_rate": None, "adjective_rate": None, "adverb_rate": None,
            "subordination_rate": None,
            "subjectivity": None, "polarity": None,
            "hedging_count": None, "hedging_ratio": None,
            "confidence_marker_count": None, "confidence_ratio": None,
            "evasion_count": None, "evasion_ratio": None,
            "bold_count": None, "has_list": None,
        }

        clean = strip_markdown(text)
        words = clean.split()

        if len(words) < self.MIN_WORDS:
            return NONE_RESULT

        metrics: dict = {}

        # --- Structure ---
        metrics["word_count"] = len(words)
        if HAS_TEXTSTAT:
            metrics["sentence_count"] = max(1, textstat.sentence_count(clean))
        else:
            # Fallback: count sentence-ending punctuation
            metrics["sentence_count"] = max(1, len(re.findall(r'[.!?]+', clean)))
        metrics["words_per_sentence"] = metrics["word_count"] / metrics["sentence_count"]

        # --- Readability ---
        if HAS_TEXTSTAT:
            metrics["flesch_kincaid_grade"] = textstat.flesch_kincaid_grade(clean)
            metrics["flesch_reading_ease"] = textstat.flesch_reading_ease(clean)
            metrics["gunning_fog"] = textstat.gunning_fog(clean)
        else:
            metrics["flesch_kincaid_grade"] = None
            metrics["flesch_reading_ease"] = None
            metrics["gunning_fog"] = None

        # --- Lexical diversity: MTLD ---
        if HAS_LEXDIV and len(words) >= 10:
            try:
                metrics["mtld"] = ld.mtld(words)
            except Exception:
                metrics["mtld"] = None
        else:
            metrics["mtld"] = None

        # --- Type-Token Ratio ---
        unique_words = set(w.lower() for w in words)
        metrics["ttr"] = len(unique_words) / len(words) if words else 0

        # --- Honoré's Statistic ---
        # R = 100 * log(N) / (1 - V1/V)
        word_counts = Counter(w.lower() for w in words)
        N = len(words)
        V = len(word_counts)
        V1 = sum(1 for w, c in word_counts.items() if c == 1)
        if V > 0 and V1 < V:
            metrics["honore_statistic"] = 100 * math.log(N) / (1 - V1 / V)
        else:
            metrics["honore_statistic"] = None

        # --- Word frequency ranks (Brown corpus) ---
        content_words = [
            w.lower() for w in words
            if w.lower() not in self._stopwords and w.isalpha()
        ]
        if content_words:
            ranks = [self._brown_ranked.get(w, self._max_rank) for w in content_words]
            metrics["avg_word_freq_rank"] = statistics.mean(ranks)
            metrics["median_word_freq_rank"] = statistics.median(ranks)
            metrics["oov_rate"] = sum(
                1 for w in content_words if w not in self._brown_ranked
            ) / len(content_words)
        else:
            metrics["avg_word_freq_rank"] = None
            metrics["median_word_freq_rank"] = None
            metrics["oov_rate"] = None

        # --- POS-based linguistic markers ---
        try:
            tokens = nltk.word_tokenize(clean)
            tagged = nltk.pos_tag(tokens)
            tag_counts = Counter(tag for _, tag in tagged)
            total_tags = len(tagged)

            metrics["modal_rate"] = tag_counts.get("MD", 0) / total_tags
            adj_count = sum(tag_counts.get(t, 0) for t in ("JJ", "JJR", "JJS"))
            metrics["adjective_rate"] = adj_count / total_tags
            adv_count = sum(tag_counts.get(t, 0) for t in ("RB", "RBR", "RBS"))
            metrics["adverb_rate"] = adv_count / total_tags
            metrics["subordination_rate"] = tag_counts.get("IN", 0) / total_tags
        except Exception:
            metrics["modal_rate"] = None
            metrics["adjective_rate"] = None
            metrics["adverb_rate"] = None
            metrics["subordination_rate"] = None

        # --- Sentiment (TextBlob) ---
        if HAS_TEXTBLOB:
            try:
                blob = TextBlob(clean)
                metrics["subjectivity"] = blob.sentiment.subjectivity
                metrics["polarity"] = blob.sentiment.polarity
            except Exception:
                metrics["subjectivity"] = None
                metrics["polarity"] = None
        else:
            metrics["subjectivity"] = None
            metrics["polarity"] = None

        # --- Marker counts (case-insensitive) ---
        text_lower = text.lower()
        sentence_count = metrics["sentence_count"]

        hedge_n = _count_markers(text_lower, HEDGING_MARKERS)
        metrics["hedging_count"] = hedge_n
        metrics["hedging_ratio"] = hedge_n / sentence_count if sentence_count else None

        conf_n = _count_markers(text_lower, CONFIDENCE_MARKERS)
        metrics["confidence_marker_count"] = conf_n
        metrics["confidence_ratio"] = conf_n / sentence_count if sentence_count else None

        evasion_n = _count_markers(text_lower, EVASION_MARKERS)
        metrics["evasion_count"] = evasion_n
        metrics["evasion_ratio"] = evasion_n / sentence_count if sentence_count else None

        # --- Formatting (from raw text, not stripped) ---
        metrics["bold_count"] = len(re.findall(r'\*\*(.+?)\*\*', text))
        metrics["has_list"] = 1 if re.search(r'^\s*[-*]\s', text, re.MULTILINE) else 0

        return metrics
