import pytest
import io
import os
import shutil
from app.services import vector_store_service
from app.api.v1.files import UPLOAD_DIR

@pytest.fixture
def auth_headers(client):
    """Fixture to register and login a test user, returning auth headers with JWT token."""
    client.post(
        "/api/v1/auth/signup",
        json={"email": "test@example.com", "password": "securepassword123"}
    )
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "securepassword123"},
    )
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(autouse=True)
def clean_file_system():
    """Ensure vector store and upload files are cleaned up after runs."""
    yield
    # Clean uploads directory
    if os.path.exists(UPLOAD_DIR):
        shutil.rmtree(UPLOAD_DIR)
    # Clean vector store directories
    vs_dir = vector_store_service.VECTOR_STORE_DIR
    if os.path.exists(vs_dir):
        for f in os.listdir(vs_dir):
            try:
                os.remove(os.path.join(vs_dir, f))
            except Exception:
                pass

def test_upload_and_list_files(client, auth_headers):
    """Test uploading a file to a conversation and listing the files."""
    # 1. Create a conversation
    conv_response = client.post(
        "/api/v1/chat/conversations",
        json={"title": "Test Files Conv"},
        headers=auth_headers
    )
    conv_id = conv_response.json()["id"]
    
    # 2. Upload file
    file_content = b"This is some text content for a RAG search document. Python is a programming language."
    file_data = {"file": ("test_doc.txt", io.BytesIO(file_content), "text/plain")}
    
    upload_response = client.post(
        f"/api/v1/chat/conversations/{conv_id}/files",
        files=file_data,
        headers=auth_headers
    )
    assert upload_response.status_code == 201
    data = upload_response.json()
    assert data["filename"] == "test_doc.txt"
    assert data["status"] == "processed"
    assert "id" in data
    
    # 3. List files
    list_response = client.get(
        f"/api/v1/chat/conversations/{conv_id}/files",
        headers=auth_headers
    )
    assert list_response.status_code == 200
    list_data = list_response.json()
    assert len(list_data) == 1
    assert list_data[0]["filename"] == "test_doc.txt"
