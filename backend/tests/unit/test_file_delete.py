"""Unit tests for file vector cleanup on delete."""

import os

from app.services import vector_store_service


def test_delete_file_data_removes_disk_artifacts(tmp_path, monkeypatch):
    monkeypatch.setattr(vector_store_service, "VECTOR_STORE_DIR", str(tmp_path))

    file_id = "test-file-123"
    index_path = tmp_path / f"{file_id}.index"
    chunks_path = tmp_path / f"{file_id}.chunks"
    index_path.write_bytes(b"index")
    chunks_path.write_bytes(b"chunks")
    vector_store_service._index_memory_cache[file_id] = (None, ["chunk"])

    vector_store_service.delete_file_data(file_id)

    assert file_id not in vector_store_service._index_memory_cache
    assert not index_path.exists()
    assert not chunks_path.exists()
