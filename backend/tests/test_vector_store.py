import os
# Redirect HuggingFace caches to E: drive to bypass C: drive being full
os.environ["HF_HOME"] = "E:\\huggingface"
os.environ["SENTENCE_TRANSFORMERS_HOME"] = "E:\\huggingface"

import pytest
from app.services import vector_store_service

@pytest.fixture(autouse=True)
def clean_vector_store():
    """Ensure vector store test files are cleaned up after runs."""
    original_dir = vector_store_service.VECTOR_STORE_DIR
    yield
    if os.path.exists(original_dir):
        for f in os.listdir(original_dir):
            if f.startswith("test_file"):
                try:
                    os.remove(os.path.join(original_dir, f))
                except Exception:
                    pass

def test_chunk_and_store_and_search():
    """Test storing document text and searching for matching query content."""
    file_id = "test_file_1"
    text = "The quick brown fox jumps over the lazy dog. Python is a popular programming language. Artificial intelligence is transforming the world."
    
    # Run store operation
    vector_store_service.chunk_and_store(file_id, text)
    
    # Query index
    results = vector_store_service.search([file_id], "Tell me about jumping animals", top_k=1)
    assert len(results) > 0
    assert "fox" in results[0].lower() or "dog" in results[0].lower()

def test_search_multiple_files():
    """Test searching across multiple indices simultaneously."""
    file_id_1 = "test_file_1"
    file_id_2 = "test_file_2"
    
    vector_store_service.chunk_and_store(file_id_1, "The capital of France is Paris.")
    vector_store_service.chunk_and_store(file_id_2, "The capital of Germany is Berlin.")
    
    # Query should resolve to first file context
    results = vector_store_service.search([file_id_1, file_id_2], "Where is Paris?", top_k=1)
    assert len(results) > 0
    assert "France" in results[0]
    
    # Query should resolve to second file context
    results = vector_store_service.search([file_id_1, file_id_2], "Where is Berlin?", top_k=1)
    assert len(results) > 0
    assert "Germany" in results[0]
