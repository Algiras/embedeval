#!/usr/bin/env node
/**
 * Create challenging benchmark datasets for embedding evaluation
 * Downloads from HuggingFace using their API directly
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// HUGGINGFACE API DATASET DOWNLOAD
// ============================================================================

async function downloadHFDataset(dataset, config, split, limit = 200) {
  console.log(`  Downloading ${dataset}/${config || 'default'}...`);
  
  try {
    // Use HuggingFace datasets viewer API
    const configPart = config ? `&config=${encodeURIComponent(config)}` : '';
    const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(dataset)}&split=${split}${configPart}&offset=0&length=${limit}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.rows?.map(r => r.row) || [];
  } catch (error) {
    console.log(`    ⚠️ Failed: ${error.message}`);
    return null;
  }
}

// ============================================================================
// MTEB STS17 - Semantic Similarity
// ============================================================================

async function createSTS17Dataset() {
  console.log('\n📥 Creating MTEB STS17 dataset...');
  
  const rows = await downloadHFDataset('mteb/sts17-crosslingual-sts', 'en-en', 'test', 150);
  
  if (!rows || rows.length === 0) {
    console.log('    Using fallback data');
    return createSTS17Fallback();
  }
  
  const queries = [];
  const corpus = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const queryId = `sts17-q-${i}`;
    const docId = `sts17-d-${i}`;
    
    // Normalize score (0-5 to 0-1)
    const relevance = (row.score || 0) / 5;
    
    queries.push({
      id: queryId,
      query: row.sentence1,
      relevantDocs: relevance > 0.6 ? [docId] : [], // Only highly similar are "relevant"
      relevanceScores: relevance > 0.6 ? [relevance] : [],
      metadata: { score: row.score, type: 'similarity' }
    });
    
    corpus.push({
      id: docId,
      content: row.sentence2,
      metadata: { pairId: queryId }
    });
  }
  
  await saveDataset('mteb-sts17', queries, corpus);
  return { queries, corpus };
}

function createSTS17Fallback() {
  // Create synthetic similarity pairs with varying degrees of similarity
  const pairs = [
    // High similarity (should match)
    { q: 'A man is playing a guitar.', d: 'A person is playing a musical instrument.', score: 0.85 },
    { q: 'The cat sits on the mat.', d: 'A feline is resting on a rug.', score: 0.82 },
    { q: 'The stock market crashed today.', d: 'Financial markets experienced a major decline.', score: 0.88 },
    { q: 'Scientists discovered a new planet.', d: 'Astronomers found an unknown celestial body.', score: 0.80 },
    { q: 'The chef prepared a delicious meal.', d: 'A cook made tasty food.', score: 0.85 },
    
    // Medium similarity (borderline)
    { q: 'The dog is running in the park.', d: 'An animal moves through a green area.', score: 0.55 },
    { q: 'She is reading a book.', d: 'A person is looking at text.', score: 0.50 },
    { q: 'The car drove down the highway.', d: 'A vehicle traveled on a road.', score: 0.60 },
    
    // Low similarity (should NOT match)
    { q: 'The bird flew over the ocean.', d: 'Mathematics is a complex subject.', score: 0.10 },
    { q: 'Children are playing soccer.', d: 'The computer needs repair.', score: 0.05 },
    { q: 'It is raining heavily outside.', d: 'Python is a programming language.', score: 0.02 },
    { q: 'The sunset was beautiful.', d: 'Quantum physics studies particles.', score: 0.08 },
    
    // More high similarity
    { q: 'Machine learning algorithms improve over time.', d: 'ML models get better with more data.', score: 0.78 },
    { q: 'The economy is growing steadily.', d: 'Economic growth continues at a stable pace.', score: 0.90 },
    { q: 'Renewable energy is important.', d: 'Clean power sources matter for the future.', score: 0.75 },
    
    // More low similarity distractors
    { q: 'The mountain has snow on top.', d: 'Software development requires testing.', score: 0.03 },
    { q: 'He is drinking coffee.', d: 'Neural networks have layers.', score: 0.01 },
    { q: 'The restaurant serves Italian food.', d: 'Databases store information.', score: 0.04 },
    { q: 'Flowers bloom in spring.', d: 'HTTP is a protocol.', score: 0.02 },
    { q: 'The airplane landed safely.', d: 'CSS styles web pages.', score: 0.01 },
  ];
  
  const queries = [];
  const corpus = [];
  
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    queries.push({
      id: `sts-q-${i}`,
      query: pair.q,
      relevantDocs: pair.score > 0.6 ? [`sts-d-${i}`] : [],
      relevanceScores: pair.score > 0.6 ? [pair.score] : [],
      metadata: { score: pair.score }
    });
    corpus.push({
      id: `sts-d-${i}`,
      content: pair.d,
      metadata: {}
    });
  }
  
  return { queries, corpus };
}

// ============================================================================
// RETRIEVAL BENCHMARK - Technical Q&A
// ============================================================================

async function createRetrievalDataset() {
  console.log('\n📥 Creating retrieval benchmark dataset...');
  
  // Create a diverse technical corpus with multiple topics
  const corpus = [
    // Machine Learning
    { id: 'ml-1', content: 'Machine learning is a subset of artificial intelligence that enables systems to learn from data without explicit programming. Common approaches include supervised learning with labeled data, unsupervised learning for pattern discovery, and reinforcement learning through trial and error.' },
    { id: 'ml-2', content: 'Neural networks are computing systems inspired by biological brains. They consist of interconnected nodes organized in layers that process information. Deep learning uses networks with many hidden layers to learn hierarchical representations.' },
    { id: 'ml-3', content: 'Gradient descent is an optimization algorithm used to minimize the loss function in machine learning models. It iteratively adjusts parameters by computing gradients and moving in the direction of steepest descent.' },
    { id: 'ml-4', content: 'Overfitting occurs when a model learns noise in training data rather than general patterns. Regularization techniques like L1, L2, dropout, and early stopping help prevent overfitting by constraining model complexity.' },
    { id: 'ml-5', content: 'Transfer learning allows models trained on one task to be adapted for related tasks. Pre-trained models like BERT, GPT, and ResNet provide starting points that can be fine-tuned on smaller domain-specific datasets.' },
    
    // NLP
    { id: 'nlp-1', content: 'Word embeddings represent words as dense vectors capturing semantic meaning. Word2Vec learns embeddings by predicting context words, while GloVe combines global matrix factorization with local context windows.' },
    { id: 'nlp-2', content: 'Transformers revolutionized NLP through self-attention mechanisms that weigh importance of different input parts. Unlike RNNs, transformers process sequences in parallel, enabling faster training on large datasets.' },
    { id: 'nlp-3', content: 'BERT (Bidirectional Encoder Representations from Transformers) uses masked language modeling to create contextualized embeddings. It reads text bidirectionally to understand context from both directions.' },
    { id: 'nlp-4', content: 'Named Entity Recognition (NER) identifies and classifies named entities like persons, organizations, and locations in text. Modern NER systems use sequence labeling with BiLSTM-CRF or transformer architectures.' },
    { id: 'nlp-5', content: 'Sentiment analysis determines emotional tone in text, classifying it as positive, negative, or neutral. Approaches range from lexicon-based methods to deep learning classifiers trained on labeled reviews.' },
    
    // Databases
    { id: 'db-1', content: 'SQL databases use structured query language for relational data. Tables with rows and columns store data with relationships defined through foreign keys. ACID properties ensure transaction reliability.' },
    { id: 'db-2', content: 'NoSQL databases handle unstructured data with flexible schemas. Document stores like MongoDB, key-value stores like Redis, and graph databases like Neo4j serve different use cases than traditional SQL.' },
    { id: 'db-3', content: 'Database indexing speeds up queries by creating data structures for faster lookups. B-trees are common for range queries, while hash indexes excel at exact matches. Index selection involves query pattern analysis.' },
    { id: 'db-4', content: 'Vector databases specialize in storing and querying high-dimensional embeddings. They use approximate nearest neighbor algorithms like HNSW and IVF for efficient similarity search at scale.' },
    { id: 'db-5', content: 'Database sharding partitions data across multiple servers to handle scale. Horizontal sharding distributes rows while vertical sharding splits columns. Consistent hashing helps route queries to correct shards.' },
    
    // Web Development
    { id: 'web-1', content: 'REST APIs use HTTP methods (GET, POST, PUT, DELETE) for resource operations. Stateless design, resource-based URLs, and JSON responses are key principles. Proper status codes indicate success or failure.' },
    { id: 'web-2', content: 'GraphQL provides a query language for APIs allowing clients to request specific data. Unlike REST, a single endpoint handles queries, mutations, and subscriptions with a strongly typed schema.' },
    { id: 'web-3', content: 'React is a JavaScript library for building user interfaces using components. Virtual DOM efficiently updates only changed elements. Hooks like useState and useEffect manage state and side effects.' },
    { id: 'web-4', content: 'CSS Grid and Flexbox are layout systems for responsive web design. Grid handles two-dimensional layouts while Flexbox excels at one-dimensional distribution of items in rows or columns.' },
    { id: 'web-5', content: 'Web security involves protecting against attacks like XSS, CSRF, and SQL injection. HTTPS encrypts traffic, CORS controls resource sharing, and content security policies restrict script execution.' },
    
    // DevOps
    { id: 'devops-1', content: 'Docker containers package applications with dependencies for consistent deployment. Images are built from Dockerfiles, and containers share the host OS kernel unlike virtual machines.' },
    { id: 'devops-2', content: 'Kubernetes orchestrates container deployment across clusters. Pods group containers, services provide networking, and deployments manage replicas. YAML manifests declare desired state.' },
    { id: 'devops-3', content: 'CI/CD pipelines automate building, testing, and deploying code changes. Tools like Jenkins, GitHub Actions, and GitLab CI run workflows triggered by commits or pull requests.' },
    { id: 'devops-4', content: 'Infrastructure as Code (IaC) manages cloud resources through configuration files. Terraform uses declarative HCL, while Pulumi allows programming languages. Version control tracks infrastructure changes.' },
    { id: 'devops-5', content: 'Monitoring and observability track system health through metrics, logs, and traces. Prometheus collects metrics, ELK stack handles logs, and Jaeger provides distributed tracing.' },
    
    // Distractors - Unrelated topics
    { id: 'cook-1', content: 'Sourdough bread requires a fermented starter made from flour and water. Wild yeast and bacteria create the distinctive tangy flavor. Bulk fermentation takes 4-8 hours at room temperature.' },
    { id: 'cook-2', content: 'Italian risotto is made by gradually adding warm broth to arborio rice while stirring. The starch release creates a creamy texture. Finish with butter and parmesan cheese.' },
    { id: 'sports-1', content: 'Basketball requires dribbling, passing, and shooting skills. Five players per team compete to score through the hoop. The NBA season runs from October to June.' },
    { id: 'history-1', content: 'The Renaissance was a cultural movement beginning in 14th century Italy. Artists like Leonardo da Vinci and Michelangelo created masterpieces. Humanism emphasized individual potential.' },
  ];
  
  // Create queries that require finding specific documents
  const queries = [
    // ML queries
    { id: 'q-ml-1', query: 'How does gradient descent work in machine learning?', relevantDocs: ['ml-3'], type: 'technical' },
    { id: 'q-ml-2', query: 'What is transfer learning and why use pre-trained models?', relevantDocs: ['ml-5'], type: 'technical' },
    { id: 'q-ml-3', query: 'How to prevent overfitting in neural networks?', relevantDocs: ['ml-4'], type: 'technical' },
    { id: 'q-ml-4', query: 'deep learning neural network layers', relevantDocs: ['ml-2'], type: 'keyword' },
    
    // NLP queries
    { id: 'q-nlp-1', query: 'How do word embeddings capture semantic meaning?', relevantDocs: ['nlp-1'], type: 'technical' },
    { id: 'q-nlp-2', query: 'What is the transformer architecture in NLP?', relevantDocs: ['nlp-2'], type: 'technical' },
    { id: 'q-nlp-3', query: 'BERT masked language model bidirectional', relevantDocs: ['nlp-3'], type: 'keyword' },
    { id: 'q-nlp-4', query: 'How to identify names and organizations in text?', relevantDocs: ['nlp-4'], type: 'technical' },
    
    // Database queries
    { id: 'q-db-1', query: 'Difference between SQL and NoSQL databases', relevantDocs: ['db-1', 'db-2'], type: 'comparison' },
    { id: 'q-db-2', query: 'How do vector databases enable similarity search?', relevantDocs: ['db-4'], type: 'technical' },
    { id: 'q-db-3', query: 'database indexing B-tree performance', relevantDocs: ['db-3'], type: 'keyword' },
    { id: 'q-db-4', query: 'How to scale a database with sharding?', relevantDocs: ['db-5'], type: 'technical' },
    
    // Web queries
    { id: 'q-web-1', query: 'REST API design HTTP methods', relevantDocs: ['web-1'], type: 'technical' },
    { id: 'q-web-2', query: 'How is GraphQL different from REST?', relevantDocs: ['web-2'], type: 'comparison' },
    { id: 'q-web-3', query: 'React components virtual DOM hooks', relevantDocs: ['web-3'], type: 'keyword' },
    { id: 'q-web-4', query: 'How to protect web applications from attacks?', relevantDocs: ['web-5'], type: 'technical' },
    
    // DevOps queries
    { id: 'q-devops-1', query: 'What are Docker containers and how do they work?', relevantDocs: ['devops-1'], type: 'technical' },
    { id: 'q-devops-2', query: 'Kubernetes pod deployment service', relevantDocs: ['devops-2'], type: 'keyword' },
    { id: 'q-devops-3', query: 'How to set up automated CI/CD pipelines?', relevantDocs: ['devops-3'], type: 'technical' },
    { id: 'q-devops-4', query: 'Infrastructure as Code Terraform vs Pulumi', relevantDocs: ['devops-4'], type: 'comparison' },
    
    // Cross-domain queries (harder)
    { id: 'q-cross-1', query: 'How to store machine learning embeddings efficiently?', relevantDocs: ['db-4', 'nlp-1'], type: 'cross' },
    { id: 'q-cross-2', query: 'Deploy ML model containers to Kubernetes', relevantDocs: ['devops-1', 'devops-2'], type: 'cross' },
    { id: 'q-cross-3', query: 'Build API for NLP text classification', relevantDocs: ['web-1', 'nlp-5'], type: 'cross' },
    
    // Tricky queries (should NOT match cooking/sports)
    { id: 'q-trick-1', query: 'How to train a machine learning model?', relevantDocs: ['ml-1', 'ml-3'], type: 'technical' },
    { id: 'q-trick-2', query: 'What is the best architecture for NLP?', relevantDocs: ['nlp-2', 'nlp-3'], type: 'technical' },
  ];
  
  await saveDataset('retrieval-benchmark', queries, corpus);
  return { queries, corpus };
}

// ============================================================================
// HARD NEGATIVES DATASET - For challenging retrieval
// ============================================================================

async function createHardNegativesDataset() {
  console.log('\n📥 Creating hard negatives dataset...');
  
  // Documents with subtle differences that require semantic understanding
  const corpus = [
    // Python vs JavaScript
    { id: 'py-1', content: 'Python is an interpreted, high-level programming language known for readability. It uses indentation for code blocks and supports multiple paradigms including procedural and object-oriented programming.' },
    { id: 'js-1', content: 'JavaScript is a scripting language originally designed for web browsers. It uses curly braces for code blocks and supports event-driven, functional, and object-oriented programming styles.' },
    
    // Supervised vs Unsupervised
    { id: 'sup-1', content: 'Supervised learning trains models using labeled data where correct outputs are known. The algorithm learns to map inputs to outputs by minimizing prediction error on training examples.' },
    { id: 'unsup-1', content: 'Unsupervised learning finds patterns in data without labeled examples. Common tasks include clustering similar items together and dimensionality reduction for visualization.' },
    
    // Docker vs VM
    { id: 'docker-1', content: 'Docker containers share the host operating system kernel, making them lightweight and fast to start. They package applications with dependencies but do not include a full OS.' },
    { id: 'vm-1', content: 'Virtual machines emulate complete hardware including their own operating system. They provide strong isolation but require more resources than containers due to the full OS overhead.' },
    
    // REST vs GraphQL
    { id: 'rest-1', content: 'REST APIs expose resources at different URLs with standard HTTP methods. Each endpoint returns a fixed data structure, and clients may need multiple requests to gather related data.' },
    { id: 'graphql-1', content: 'GraphQL APIs expose a single endpoint where clients specify exactly what data they need in a query. The server returns only requested fields, reducing over-fetching and under-fetching.' },
    
    // SQL vs NoSQL
    { id: 'sql-1', content: 'Relational databases store data in tables with predefined schemas and relationships. They ensure ACID properties and use SQL for complex queries with joins across tables.' },
    { id: 'nosql-1', content: 'Document databases store data in flexible JSON-like documents without fixed schemas. They scale horizontally easily but may sacrifice some consistency guarantees for availability.' },
    
    // CNN vs RNN
    { id: 'cnn-1', content: 'Convolutional neural networks excel at processing grid-like data such as images. They use convolution layers to detect local patterns and pooling to reduce spatial dimensions.' },
    { id: 'rnn-1', content: 'Recurrent neural networks process sequential data by maintaining hidden state across time steps. They are suited for text and time series where order matters.' },
    
    // More confusable pairs
    { id: 'bert-1', content: 'BERT is a bidirectional transformer encoder pretrained on masked language modeling. It creates contextual embeddings useful for classification, NER, and question answering.' },
    { id: 'gpt-1', content: 'GPT is a unidirectional transformer decoder pretrained on next token prediction. It excels at text generation, completion, and can be prompted for various tasks.' },
    
    { id: 'precision-1', content: 'Precision measures what fraction of predicted positives are actually positive. High precision means few false positives, important when false alarms are costly.' },
    { id: 'recall-1', content: 'Recall measures what fraction of actual positives were correctly predicted. High recall means few false negatives, important when missing cases is costly.' },
  ];
  
  const queries = [
    // Specific language queries
    { id: 'hard-1', query: 'Which programming language uses indentation for blocks?', relevantDocs: ['py-1'], difficulty: 'hard' },
    { id: 'hard-2', query: 'What language was designed for browsers?', relevantDocs: ['js-1'], difficulty: 'hard' },
    
    // ML concept queries
    { id: 'hard-3', query: 'Learning from labeled examples with known outputs', relevantDocs: ['sup-1'], difficulty: 'hard' },
    { id: 'hard-4', query: 'Finding patterns without labeled data', relevantDocs: ['unsup-1'], difficulty: 'hard' },
    
    // Infrastructure queries
    { id: 'hard-5', query: 'Lightweight isolation that shares host kernel', relevantDocs: ['docker-1'], difficulty: 'hard' },
    { id: 'hard-6', query: 'Complete OS emulation with strong isolation', relevantDocs: ['vm-1'], difficulty: 'hard' },
    
    // API queries
    { id: 'hard-7', query: 'API style with multiple endpoints and fixed responses', relevantDocs: ['rest-1'], difficulty: 'hard' },
    { id: 'hard-8', query: 'Single endpoint API where clients specify fields', relevantDocs: ['graphql-1'], difficulty: 'hard' },
    
    // Neural network queries
    { id: 'hard-9', query: 'Neural networks for image and spatial data', relevantDocs: ['cnn-1'], difficulty: 'hard' },
    { id: 'hard-10', query: 'Neural networks for sequences with memory', relevantDocs: ['rnn-1'], difficulty: 'hard' },
    
    // Transformer queries
    { id: 'hard-11', query: 'Bidirectional transformer with masked language modeling', relevantDocs: ['bert-1'], difficulty: 'hard' },
    { id: 'hard-12', query: 'Autoregressive transformer for text generation', relevantDocs: ['gpt-1'], difficulty: 'hard' },
    
    // Metrics queries
    { id: 'hard-13', query: 'Metric for avoiding false positives', relevantDocs: ['precision-1'], difficulty: 'hard' },
    { id: 'hard-14', query: 'Metric for avoiding missed positives', relevantDocs: ['recall-1'], difficulty: 'hard' },
  ];
  
  await saveDataset('hard-negatives', queries, corpus);
  return { queries, corpus };
}

// ============================================================================
// UTILITIES
// ============================================================================

async function saveDataset(name, queries, corpus) {
  const dir = path.join(__dirname, '../datasets', name);
  await fs.mkdir(dir, { recursive: true });
  
  await fs.writeFile(
    path.join(dir, 'queries.jsonl'),
    queries.map(q => JSON.stringify(q)).join('\n')
  );
  await fs.writeFile(
    path.join(dir, 'corpus.jsonl'),
    corpus.map(d => JSON.stringify(d)).join('\n')
  );
  
  console.log(`    ✓ Saved ${queries.length} queries, ${corpus.length} documents to datasets/${name}/`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 Creating Benchmark Datasets for EmbedEval');
  console.log('=' .repeat(60));
  
  // Create all datasets
  await createSTS17Dataset();
  await createRetrievalDataset();
  await createHardNegativesDataset();
  
  console.log('\n✅ All datasets created!');
  console.log('\nDatasets available:');
  console.log('  - datasets/mteb-sts17/       (semantic similarity)');
  console.log('  - datasets/retrieval-benchmark/  (technical Q&A)');
  console.log('  - datasets/hard-negatives/   (confusable pairs)');
  console.log('\nRun evolution with:');
  console.log('  node scripts/run-hf-evolution.mjs');
}

main().catch(console.error);
