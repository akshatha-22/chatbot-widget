# Epics, User Stories, and Use Cases

This document details the functional requirements of the file-based chatbot from the perspective of the end-user, structured into Epics, User Stories, and Use Cases.

## 1. Epics

Epics are large bodies of work that can be broken down into smaller, more manageable user stories. For this project, the primary epics are:

*   **Epic 1: Document Ingestion and Processing**: This epic covers all functionalities related to uploading, parsing, and preparing documents for the chatbot to understand.
*   **Epic 2: Conversational Interface**: This epic encompasses the user interface and the interactive chat experience, including querying and receiving responses.
*   **Epic 3: Contextual Understanding and Retrieval**: This epic focuses on the backend mechanisms that allow the chatbot to retrieve relevant information from the uploaded documents and generate accurate answers.

## 2. User Stories

User stories describe specific features from the user's perspective, following the format: "As a [user persona], I want to [action] so that [benefit/value]."

### Epic 1: Document Ingestion and Processing

*   **User Story 1.1**: As a user, I want to be able to upload PDF documents so that I can interact with their content.
*   **User Story 1.2**: As a user, I want to be able to upload plain text (TXT) files so that I can interact with their content.
*   **User Story 1.3**: As a user, I want to see a clear indication (e.g., a loading spinner or success message) when my file is being processed, so that I know the system is working.
*   **User Story 1.4**: As a user, I want the system to handle errors gracefully if I upload an unsupported file format, so that I understand what went wrong. *(Shipped: client validation banner + server MIME check 415; file picker shows all files.)*
*   **User Story 1.5**: As a user, I want uploaded document embeddings to survive server redeploys, so I do not have to re-upload after every Railway restart. *(Shipped: pgvector rows in PostgreSQL `embeddings` table.)*
*   **User Story 1.6**: As a user, I want to delete an uploaded file I no longer need, so that it is removed from my conversation and storage. *(Shipped: `DELETE .../files/{id}` + `FileListItem` inline confirm + optimistic UI.)*

### Epic 2: Conversational Interface

*   **User Story 2.1**: As a user, I want a clean and intuitive chat interface where I can type my questions.
*   **User Story 2.2**: As a user, I want to see the history of my conversation with the chatbot, so that I can refer back to previous questions and answers.
*   **User Story 2.3**: As a user, I want the chatbot's responses to be clearly distinguishable from my own messages.
*   **User Story 2.4**: As a user, I want my login credentials protected from brute-force attacks, so that my account remains secure. *(Shipped: auth rate limiting — 5 failed attempts/min per IP on login and signup.)*
*   **User Story 2.5**: As a user, I want a visually distinct launcher that fits any host site, so the widget feels modern and embeddable. *(Shipped: dark sphere + soft blue radial halo in `RemiFace.tsx`.)*
*   **User Story 2.6**: As a user, I want to search and filter my conversations, so I can find past chats quickly. *(Shipped: `SearchFilterPanel.tsx` — text, date, file, and status filters.)*

### Epic 3: Contextual Understanding and Retrieval

*   **User Story 3.1**: As a user, I want the chatbot to answer my questions based *only* on the content of the uploaded document, so that I receive accurate and relevant information.
*   **User Story 3.2**: As a user, I want to be able to ask follow-up questions that refer to previous parts of the conversation, so that I can have a natural dialogue.
*   **User Story 3.3**: As a user, I want the chatbot to inform me if the answer to my question cannot be found in the uploaded document, rather than guessing or providing incorrect information.
*   **User Story 3.4**: As a user, I want to be able to generate and download a summary of the uploaded document, so that I can quickly grasp its main points or share them with others.

## 3. Use Cases

Use cases describe specific scenarios in which a user interacts with the system to achieve a goal.

### Use Case 1: Analyzing a Financial Report

*   **Actor**: Financial Analyst
*   **Precondition**: The user has a PDF copy of a company's annual financial report.
*   **Flow**:
    1.  The user uploads the financial report PDF to the chatbot.
    2.  The system processes the document and indicates readiness.
    3.  The user asks, "What was the total revenue for Q3?"
    4.  The chatbot retrieves the relevant section from the report and answers with the specific figure.
    5.  The user asks a follow-up question, "How does that compare to Q2?"
    6.  The chatbot uses the conversation history and the document context to provide the comparison.
*   **Postcondition**: The user has extracted specific financial data without manually reading the entire report.

### Use Case 2: Reviewing a Legal Contract

*   **Actor**: Lawyer or Business Owner
*   **Precondition**: The user has a TXT or PDF file of a legal contract.
*   **Flow**:
    1.  The user uploads the contract to the chatbot.
    2.  The system processes the document.
    3.  The user asks, "What are the termination clauses in this contract?"
    4.  The chatbot summarizes the conditions under which the contract can be terminated, based on the document text.
    5.  The user asks, "Is there a non-compete clause?"
    6.  The chatbot confirms the presence or absence of the clause and provides details if it exists.
*   **Postcondition**: The user has quickly identified key clauses and potential risks within the contract.

### Use Case 3: Studying Academic Papers

### Use Case 4: Generating Document Summaries

*   **Actor**: Any User
*   **Precondition**: The user has uploaded and processed a document.
*   **Flow**:
    1.  The user clicks the "Generate & Download Summary" button.
    2.  The chatbot processes the document content to create a summary.
    3.  A download button appears, allowing the user to save the summary as a TXT file.
*   **Postcondition**: The user has a concise summary of the document in a downloadable format.

*   **Actor**: Student or Researcher
*   **Precondition**: The user has a PDF of an academic research paper.
*   **Flow**:
    1.  The user uploads the research paper.
    2.  The system processes the document.
    3.  The user asks, "What is the main hypothesis of this study?"
    4.  The chatbot extracts and presents the core hypothesis.
    5.  The user asks, "Summarize the methodology used."
    6.  The chatbot provides a concise summary of the research methods described in the paper.
*   **Postcondition**: The user has quickly grasped the key concepts and findings of the research paper.
