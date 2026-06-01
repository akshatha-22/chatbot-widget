import os
import pickle
from typing import List

# Define storage directory for vector store indices
VECTOR_STORE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "vector_store")
)

_model = None


def get_embedding_model():
    """Lazily load the SentenceTransformer model (avoids import at startup / in CI)."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def split_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[str]:
    """Splits document text into clean, smaller chunks using paragraphs/sentences."""
    if not text:
        return []

    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue

        if len(current_chunk) + len(paragraph) <= chunk_size:
            if current_chunk:
                current_chunk += "\n\n" + paragraph
            else:
                current_chunk = paragraph
        else:
            if current_chunk:
                chunks.append(current_chunk)

            if len(paragraph) > chunk_size:
                sentences = paragraph.split(". ")
                sub_chunk = ""
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    if len(sub_chunk) + len(sentence) <= chunk_size:
                        if sub_chunk:
                            sub_chunk += ". " + sentence
                        else:
                            sub_chunk = sentence
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk)
                        sub_chunk = sentence
                if sub_chunk:
                    current_chunk = sub_chunk
            else:
                current_chunk = paragraph

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def chunk_and_store(file_id: str, text: str):
    """Split text, generate sentence embeddings, and store them in a local FAISS index."""
    import faiss
    import numpy as np

    chunks = split_text(text)
    if not chunks:
        raise ValueError("No indexable text chunks after splitting document")

    model = get_embedding_model()
    embeddings = model.encode(chunks)
    dimension = embeddings.shape[1]

    index = faiss.IndexFlatL2(dimension)
    index.add(np.array(embeddings).astype("float32"))

    os.makedirs(VECTOR_STORE_DIR, exist_ok=True)

    index_path = os.path.join(VECTOR_STORE_DIR, f"{file_id}.index")
    chunks_path = os.path.join(VECTOR_STORE_DIR, f"{file_id}.chunks")

    faiss.write_index(index, index_path)
    with open(chunks_path, "wb") as f:
        pickle.dump(chunks, f)


def search(file_ids: List[str], query: str, top_k: int = 5) -> List[str]:
    """Search matching chunks across multiple file IDs, sorted by relevance (L2 distance)."""
    import faiss
    import numpy as np

    if not file_ids:
        return []

    model = get_embedding_model()
    query_vector = model.encode([query])
    query_np = np.array(query_vector).astype("float32")

    all_matches = []

    for file_id in file_ids:
        index_path = os.path.join(VECTOR_STORE_DIR, f"{file_id}.index")
        chunks_path = os.path.join(VECTOR_STORE_DIR, f"{file_id}.chunks")

        print(f"[FAISS] Looking for index at: {index_path}")
        print(f"[FAISS] Index exists: {os.path.exists(index_path)}")

        if not os.path.exists(index_path) or not os.path.exists(chunks_path):
            print(f"[FAISS] Index not found for {file_id}")
            continue

        try:
            index = faiss.read_index(index_path)
            with open(chunks_path, "rb") as f:
                chunks = pickle.load(f)

            distances, indices = index.search(query_np, min(top_k, len(chunks)))

            for dist, idx in zip(distances[0], indices[0]):
                if idx != -1 and idx < len(chunks):
                    all_matches.append((chunks[idx], float(dist)))
        except Exception as e:
            print(f"[FAISS] Search error for {file_id}: {e}")
            import traceback

            traceback.print_exc()

    all_matches.sort(key=lambda x: x[1])

    seen = set()
    unique_chunks = []
    for chunk, _ in all_matches:
        if chunk not in seen:
            seen.add(chunk)
            unique_chunks.append(chunk)
            if len(unique_chunks) >= top_k:
                break

    return unique_chunks
