"""
Classifies retrieved RAG context into four quality levels.
Used to decide how much to trust the document vs web.
"""

from enum import Enum


class RAGQuality(str, Enum):
    DIRECT = "direct"
    PARTIAL = "partial"
    DEFLECTED = "deflected"
    EMPTY = "empty"


DEFLECTION_PHRASES = [
    "contact",
    "call us",
    "speak to",
    "salesman",
    "cannot list",
    "unable to list",
    "contact our",
    "please contact",
    "get in touch",
    "reach out",
    "we are unable",
    "we cannot",
    "not possible to list",
    "due to volume",
    "constantly growing range",
    "for more information contact",
    "enquire",
    "visit our website",
    "see your dealer",
]


def classify_rag_context(rag_context: str, query: str) -> RAGQuality:
    """
    Classify the quality of retrieved RAG context relative to the user's query.
    Never raises — returns EMPTY on any error.
    """
    try:
        if not rag_context or len(rag_context.strip()) < 30:
            return RAGQuality.EMPTY

        context_lower = rag_context.lower()

        deflection_count = sum(
            1 for phrase in DEFLECTION_PHRASES if phrase in context_lower
        )
        if deflection_count >= 2:
            return RAGQuality.DEFLECTED

        query_terms = [t for t in query.lower().split() if len(t) > 3]
        if not query_terms:
            return RAGQuality.PARTIAL

        matches = sum(1 for term in query_terms if term in context_lower)
        coverage = matches / len(query_terms)

        if coverage >= 0.6:
            return RAGQuality.DIRECT
        if coverage >= 0.2:
            return RAGQuality.PARTIAL
        return RAGQuality.EMPTY

    except Exception:
        return RAGQuality.EMPTY
