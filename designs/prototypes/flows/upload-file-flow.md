# Upload File Flow

## User Flow: Uploading a File

### Steps

1. **User initiates upload**
   - Click upload icon in message input area
   - File picker dialog opens
   - Multiple file selection supported

2. **User selects files**
   - Supported formats: PDF, DOC, DOCX, TXT, CSV, JSON
   - Maximum file size: 10MB per file
   - Maximum total: 50MB per conversation

3. **Files are queued**
   - Files appear in file panel
   - Upload progress shown
   - User can remove files before sending

4. **User sends with files**
   - Click send to submit message with files
   - Files upload to server
   - Progress indicators update

5. **Upload complete**
   - Files confirmed and processed
   - Message sent with file metadata
   - Chat history includes file references

## File States

- **Pending**: Queued for upload
- **Uploading**: In progress, progress bar shown
- **Uploaded**: Complete, ready to send
- **Sending**: Part of message submission
- **Sent**: Delivered with message
- **Error**: Upload failed, retry option

## Error Handling

- File too large: Show warning
- Unsupported format: Reject file
- Network error: Show retry
- Server error: Show friendly message
- Timeout: Retry mechanism

## Validations

- File size check (10MB max)
- File format validation
- Duplicate file prevention
- Total size limit (50MB)
