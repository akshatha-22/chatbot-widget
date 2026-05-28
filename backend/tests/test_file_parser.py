import pytest
import os
import tempfile
from app.services import file_parser_service

def test_extract_text_txt():
    """Test text extraction from a plain text (.txt) file."""
    content = "Hello, this is a test text file with sample document content."
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="w+", delete=False, encoding="utf-8") as tmp:
        tmp.write(content)
        tmp_path = tmp.name
        
    try:
        extracted = file_parser_service.extract_text(tmp_path, "test.txt")
        assert content in extracted
    finally:
        os.remove(tmp_path)

def test_extract_text_missing_file():
    """Test parser raises FileNotFoundError when target file does not exist."""
    with pytest.raises(FileNotFoundError):
        file_parser_service.extract_text("nonexistent_file_path.pdf", "nonexistent_file.pdf")
