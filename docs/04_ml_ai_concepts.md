# 04_ml_ai_concepts

This document explains the machine learning and artificial intelligence concepts underlying the chatbot widget system.

---

## 1. Retrieval-Augmented Generation (RAG)

### 1.1. Overview

Retrieval-Augmented Generation (RAG) is a technique that combines information retrieval with text generation to produce more accurate and contextually relevant responses. Instead of relying solely on the LLM's training data, RAG retrieves relevant documents or passages and uses them as context for generating responses.

### 1.2. How RAG Works

The RAG pipeline consists of three main steps:

1. **Retrieval**: When a user asks a question, the system searches a knowledge base (vector store) to find the most relevant documents or passages related to the query.
2. **Augmentation**: The retrieved documents are combined with the user's query to create an augmented prompt.
3. **Generation**: The LLM generates a response based on the augmented prompt, ensuring the answer is grounded in the retrieved context.

### 1.3. Benefits of RAG

RAG provides several advantages over traditional LLM approaches:

- **Accuracy**: Responses are grounded in actual documents, reducing hallucinations.
- **Up-to-date Information**: The knowledge base can be updated without retraining the LLM.
- **Transparency**: Users can see which documents were used to generate the response.
- **Domain-Specific Knowledge**: The system can be specialized for specific domains by curating the knowledge base.

### 1.4. RAG in the Chatbot Widget

In the chatbot widget, RAG is used when users upload files. The uploaded documents are processed, chunked, and embedded. When the user asks a question, the system retrieves relevant chunks from the vector store and uses them to generate a response.

---

## 2. Embeddings and Vector Representations

### 2.1. What are Embeddings?

Embeddings are numerical vector representations of text that capture semantic meaning. Each word, phrase, or document is represented as a point in a high-dimensional space (typically 768 to 1536 dimensions for modern models).

### 2.2. Embedding Models

The chatbot widget uses embedding models to convert text into vectors:

- **OpenAI Embeddings**: `text-embedding-3-small` (1536 dimensions) and `text-embedding-3-large` (3072 dimensions)
- **Cohere Embeddings**: `embed-v4.0` with multilingual support
- **Google Embeddings**: `text-embedding-004` with competitive pricing
- **Open-Source Models**: BERT, E5, BGE (can be self-hosted)

### 2.3. Similarity Search

Once text is converted to embeddings, the system can compute similarity between vectors using distance metrics:

- **Cosine Similarity**: Measures the angle between vectors (most common)
- **Euclidean Distance**: Measures the straight-line distance between vectors
- **Manhattan Distance**: Measures the sum of absolute differences

### 2.4. Vector Store (FAISS)

FAISS (Facebook AI Similarity Search) is a library for efficient similarity search in high-dimensional spaces. It uses various indexing techniques to speed up searches:

- **Flat Index**: Brute-force search (accurate but slow)
- **IVF (Inverted File)**: Partitions vectors into clusters for faster search
- **HNSW (Hierarchical Navigable Small World)**: Graph-based indexing for very fast search
- **Product Quantization**: Compresses vectors for memory efficiency

---

## 3. Large Language Models (LLMs)

### 3.1. How LLMs Work

Large Language Models are neural networks trained on vast amounts of text data to predict the next word in a sequence. They use the Transformer architecture, which relies on attention mechanisms to understand relationships between words.

### 3.2. Key LLM Concepts

**Tokens**: LLMs process text as tokens (subwords or words). The number of tokens affects both cost and response time.

**Context Window**: The maximum number of tokens the LLM can consider at once. Larger context windows allow the model to understand longer documents but increase computational cost.

**Temperature**: Controls the randomness of responses. Lower temperature (0.0-0.5) produces deterministic, focused responses. Higher temperature (0.7-1.0) produces more creative, diverse responses.

**Top-p (Nucleus Sampling)**: An alternative to temperature that samples from the smallest set of tokens with cumulative probability ≥ p.

### 3.3. LLMs Used in the Chatbot Widget

| Model | Provider | Context Window | Strengths |
| :--- | :--- | :--- | :--- |
| GPT-4.1 | OpenAI | 1M tokens | Best all-around, excellent function calling |
| Claude 3.5 Sonnet | Anthropic | 200K tokens | Excellent coding, long outputs (128K) |
| Gemini 2.5 Flash | Google | 1M tokens | Best value, free tier available |
| DeepSeek V3.2 | DeepSeek | 128K tokens | Extremely cost-effective |

### 3.4. Prompt Engineering

The quality of LLM responses depends heavily on how prompts are structured. Effective prompt engineering includes:

- **System Prompts**: Instructions that define the LLM's behavior and role
- **Few-Shot Examples**: Examples of desired input-output pairs
- **Chain-of-Thought Prompting**: Encouraging the model to explain its reasoning
- **Structured Prompts**: Using templates and formatting for consistent outputs

---

## 4. Document Processing and Chunking

### 4.1. Why Chunking is Important

Documents are too large to fit entirely into an LLM's context window. Chunking breaks documents into smaller pieces that can be processed individually and retrieved as needed.

### 4.2. Chunking Strategies

**Fixed-Size Chunking**: Divides text into fixed-size chunks (e.g., 1000 tokens).

**Overlapping Chunking**: Creates chunks with overlap to maintain context across chunk boundaries (e.g., 1000 tokens with 100 token overlap).

**Semantic Chunking**: Divides text at semantic boundaries (sentences, paragraphs, sections) to preserve meaning.

**Hierarchical Chunking**: Creates chunks at multiple levels of granularity (paragraphs, sections, chapters).

### 4.3. Chunk Size Selection

The optimal chunk size depends on several factors:

- **Document Type**: Technical documents may benefit from larger chunks; conversational text from smaller chunks.
- **Query Type**: Specific queries may need smaller chunks; broad queries may benefit from larger chunks.
- **Embedding Model**: Different embedding models perform better with different chunk sizes.

The chatbot widget uses a default chunk size of 1000 tokens with 100 token overlap, which provides a good balance for most use cases.

---

## 5. Semantic Search and Retrieval

### 5.1. How Semantic Search Works

Unlike keyword-based search, semantic search understands the meaning of queries and documents:

1. **Query Embedding**: The user's query is converted to a vector embedding.
2. **Similarity Computation**: The system computes the similarity between the query embedding and all document embeddings.
3. **Ranking**: Documents are ranked by similarity score.
4. **Retrieval**: The top-k most similar documents are retrieved.

### 5.2. Retrieval Parameters

**k (Number of Results)**: How many documents to retrieve. Typical values are 5-10. Larger k provides more context but may introduce noise.

**Similarity Threshold**: A minimum similarity score for retrieved documents. Documents below the threshold are filtered out.

**Reranking**: After initial retrieval, documents can be reranked using more sophisticated models (e.g., Cohere Rerank) to improve quality.

### 5.3. Retrieval Evaluation Metrics

- **Precision**: What fraction of retrieved documents are relevant?
- **Recall**: What fraction of relevant documents are retrieved?
- **Mean Reciprocal Rank (MRR)**: Average rank of the first relevant document.
- **Normalized Discounted Cumulative Gain (NDCG)**: Considers both relevance and ranking position.

---

## 6. Conversational AI and Context Management

### 6.1. Conversation Context

Maintaining context across multiple turns is crucial for natural conversations. The system stores:

- **Message History**: All previous user and assistant messages in the conversation.
- **File References**: Which files are relevant to the conversation.
- **Metadata**: Timestamps, user information, conversation settings.

### 6.2. Context Window Management

As conversations grow longer, the total context can exceed the LLM's context window. The system manages this through:

- **Summarization**: Summarizing older messages to compress context.
- **Sliding Window**: Keeping only the most recent messages.
- **Relevance Filtering**: Keeping only messages relevant to the current query.

### 6.3. Memory Types

**Short-Term Memory**: The current conversation's messages (stored in the LLM's context window).

**Long-Term Memory**: Historical conversations stored in the database.

**Semantic Memory**: Embeddings of important concepts and documents.

---

## 7. Text Generation and Decoding Strategies

### 7.1. Decoding Strategies

Different strategies can be used to generate text from an LLM:

**Greedy Decoding**: Always select the token with the highest probability. Fast but may produce suboptimal results.

**Beam Search**: Maintain multiple hypotheses and explore the most promising paths. Better quality but slower.

**Sampling**: Randomly sample from the probability distribution. More diverse but less predictable.

**Top-k Sampling**: Sample from the k most likely tokens. Balances diversity and quality.

**Nucleus (Top-p) Sampling**: Sample from the smallest set of tokens with cumulative probability ≥ p. More flexible than top-k.

### 7.2. Generation Parameters

**Max Tokens**: Maximum length of the generated response.

**Temperature**: Controls randomness (0.0 = deterministic, 1.0+ = very random).

**Top-p**: Nucleus sampling parameter.

**Frequency Penalty**: Reduces the likelihood of repeating tokens.

**Presence Penalty**: Reduces the likelihood of repeating topics.

---

## 8. Fine-Tuning and Customization

### 8.1. Fine-Tuning

Fine-tuning involves training an LLM on a specific dataset to adapt it to a particular domain or task. For the chatbot widget:

- **Domain-Specific Fine-Tuning**: Train the model on domain-specific documents to improve performance.
- **Task-Specific Fine-Tuning**: Train the model on examples of desired input-output pairs.
- **Few-Shot Learning**: Provide a few examples in the prompt instead of fine-tuning.

### 8.2. In-Context Learning

Instead of fine-tuning, modern LLMs can learn from examples provided in the prompt (few-shot learning). This is faster and more flexible than fine-tuning.

### 8.3. Prompt Optimization

The system can optimize prompts through:

- **A/B Testing**: Compare different prompts and measure performance.
- **Automated Optimization**: Use techniques like genetic algorithms to evolve prompts.
- **User Feedback**: Collect feedback on responses and adjust prompts accordingly.

---

## 9. Evaluation and Quality Metrics

### 9.1. Response Quality Metrics

**Relevance**: Does the response answer the user's question?

**Accuracy**: Is the information in the response correct?

**Completeness**: Does the response provide sufficient detail?

**Clarity**: Is the response easy to understand?

**Coherence**: Does the response flow logically?

### 9.2. Automated Evaluation

Automated metrics can assess response quality:

- **BLEU Score**: Measures overlap between generated and reference text.
- **ROUGE Score**: Measures recall of overlapping n-grams.
- **Semantic Similarity**: Measures semantic similarity between generated and reference text.
- **Perplexity**: Measures how well the model predicts the text.

### 9.3. Human Evaluation

Human evaluation is often necessary for comprehensive quality assessment:

- **Likert Scale Ratings**: Rate responses on a scale (1-5).
- **Pairwise Comparison**: Compare two responses and choose the better one.
- **Ranking**: Rank multiple responses by quality.

---

## 10. Handling Hallucinations and Errors

### 10.1. Hallucinations

Hallucinations occur when the LLM generates plausible-sounding but false information. RAG helps mitigate this by grounding responses in retrieved documents.

### 10.2. Mitigation Strategies

- **Retrieval-Augmented Generation**: Ensure responses are grounded in actual documents.
- **Confidence Scoring**: Estimate the model's confidence in its response.
- **Fact-Checking**: Verify generated facts against a knowledge base.
- **Uncertainty Acknowledgment**: Encourage the model to express uncertainty.

### 10.3. Error Handling

The system handles various error scenarios:

- **No Relevant Documents**: When no relevant documents are found, the system informs the user.
- **Ambiguous Queries**: When the query is ambiguous, the system asks for clarification.
- **Out-of-Domain Queries**: When the query is outside the document's domain, the system acknowledges this.

---

## 11. Scalability and Optimization

### 11.1. Batch Processing

For processing large volumes of documents or queries:

- **Batch Embeddings**: Generate embeddings for multiple documents in parallel.
- **Batch Inference**: Process multiple queries simultaneously.
- **Asynchronous Processing**: Use message queues for non-blocking processing.

### 11.2. Caching Strategies

- **Embedding Cache**: Cache embeddings to avoid recomputation.
- **Response Cache**: Cache responses for identical queries.
- **LLM Cache**: Cache LLM outputs for common queries.

### 11.3. Model Optimization

- **Quantization**: Reduce model size and inference time by using lower precision (e.g., int8).
- **Distillation**: Train smaller models to mimic larger models.
- **Pruning**: Remove less important weights from the model.

---

## 12. Ethical Considerations

### 12.1. Bias and Fairness

LLMs can perpetuate biases present in their training data. The system should:

- **Monitor for Bias**: Regularly audit responses for biased language or recommendations.
- **Diverse Training Data**: Use diverse training data to reduce bias.
- **User Feedback**: Collect feedback on biased responses and adjust accordingly.

### 12.2. Transparency and Explainability

Users should understand how the system works:

- **Source Attribution**: Show which documents were used to generate responses.
- **Confidence Scores**: Indicate the model's confidence in its response.
- **Explanation Generation**: Explain the reasoning behind responses.

### 12.3. Privacy and Data Protection

- **Data Minimization**: Collect only necessary data.
- **Encryption**: Encrypt data in transit and at rest.
- **User Control**: Allow users to control their data and delete it if desired.
- **Compliance**: Comply with regulations like GDPR and CCPA.

---

## Conclusion

Understanding these ML and AI concepts is crucial for effectively using and customizing the chatbot widget. The system leverages state-of-the-art techniques in retrieval, embeddings, and language generation to provide accurate, contextually relevant responses while maintaining transparency and ethical standards.
